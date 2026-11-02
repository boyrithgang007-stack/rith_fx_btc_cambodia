import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,deps={}) {
  const loaded={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('exports','module','require',code)(loaded.exports,loaded,name=>name in deps?deps[name]:require(name));
  return loaded.exports;
}
process.env.ABA_PAYWAY_MERCHANT_ID='testmerchant';
process.env.ABA_PAYWAY_API_KEY='private-test-key';
process.env.ABA_PAYWAY_MODE='sandbox';
const aba=load('app/lib/payments/aba.ts');
test('payment amounts use integer minor units and reject unsupported currencies/precision/limits',()=>{
  assert.deepEqual(aba.parsePaymentAmount('0.29','USD'),{minor:29,amount:'0.29',currency:'USD'});
  assert.equal(aba.parsePaymentAmount('99','KHR'),null);
  assert.equal(aba.parsePaymentAmount('100.1','KHR'),null);
  assert.equal(aba.parsePaymentAmount('1.001','USD'),null);
  assert.equal(aba.parsePaymentAmount('1e3','USD'),null);
  assert.equal(aba.parsePaymentAmount('10001','USD'),null);
  assert.equal(aba.parsePaymentAmount('10','EUR'),null);
});
test('ABA QR requests use sandbox, server merchant and documented signature field order',async()=>{
  const qr=await aba.createAbaQr('01234567890123456789','10.00','USD',async(url,options)=>{
    assert.match(url,/^https:\/\/checkout-sandbox\.payway\.com\.kh\//);
    const body=JSON.parse(options.body);
    const fields=['req_time','merchant_id','tran_id','amount','items','first_name','last_name','email','phone','purchase_type','payment_option','callback_url','return_deeplink','currency','custom_fields','return_params','payout','lifetime','qr_image_template'];
    const expected=createHmac('sha512',process.env.ABA_PAYWAY_API_KEY).update(fields.map(f=>String(body[f]??'')).join('')).digest('base64');
    assert.equal(body.hash,expected);
    assert.equal(body.merchant_id,'testmerchant');
    return Response.json({status:{code:'0'},amount:10,currency:'USD',qrImage:'data:image/png;base64,aGVsbG8='});
  });
  assert.equal(qr.mode,'sandbox');
});
test('payment verification rejects spoofed transaction identity, mismatched amounts and refunds',async()=>{
  const response={status:{code:'00',tran_id:'invoice1'},data:{payment_status:'APPROVED',payment_status_code:0,payment_currency:'USD',original_amount:10,payment_amount:10,refund_amount:0}};
  assert.equal(await aba.verifyAbaPayment('invoice1','10.00','USD',async()=>Response.json(response)),'paid');
  for(const altered of [{...response,status:{code:'00',tran_id:'someoneelse'}},{...response,data:{...response.data,original_amount:1}},{...response,data:{...response.data,payment_currency:'KHR'}},{...response,data:{...response.data,refund_amount:5}}])await assert.rejects(aba.verifyAbaPayment('invoice1','10.00','USD',async()=>Response.json(altered)));
  assert.equal(await aba.verifyAbaPayment('invoice1','10.00','USD',async()=>Response.json({...response,data:{payment_status:'PENDING',payment_status_code:2}})),'pending');
});
test('bank configuration and provider errors do not expose secret values',async()=>{
  const key=process.env.ABA_PAYWAY_API_KEY;
  await assert.rejects(aba.createAbaQr('id','10','USD',async()=>{throw Error(key);}),e=>!e.message.includes(key));
  delete process.env.ABA_PAYWAY_API_KEY;
  assert.throws(()=>aba.paymentConfig(),aba.PaymentConfigurationError);
  process.env.ABA_PAYWAY_API_KEY=key;
});
test('payment records isolate members and keep provider-confirmed status in persistent storage',()=>{
  const Database=require('better-sqlite3'),database=new Database(':memory:');
  database.pragma('foreign_keys=ON');
  database.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('alice'),('bob')");
  const store=load('app/lib/payments/store.ts',{'../auth':{database}});
  store.createPaymentRecord('invoice1','alice','10.00','USD','sandbox');
  assert.equal(store.paymentRecord('bob','invoice1'),undefined);
  store.setPaymentStatus('bob','invoice1','paid');
  assert.equal(store.paymentRecord('alice','invoice1').status,'creating');
  store.setPaymentQr('alice','invoice1','data:image/png;base64,aGVsbG8=');
  assert.equal(store.paymentRecord('alice','invoice1').status,'pending');
  store.setPaymentStatus('alice','invoice1','paid');
  assert.equal(store.listPaymentRecords('alice')[0].status,'paid');
  assert.equal(store.listPaymentRecords('bob').length,0);
  database.close();
});
