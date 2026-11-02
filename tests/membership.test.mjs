import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as jose from 'jose';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
function load(file,dependencies={}) {
  const loaded={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('exports','module','require','fetch',source)(loaded.exports,loaded,name=>name in dependencies ? dependencies[name] : require(name),dependencies.__fetch ?? globalThis.fetch);
  return loaded.exports;
}
const membership=load('app/lib/membership.ts');
const db=new Database(':memory:');
db.pragma('foreign_keys = ON');
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,created_at TEXT); INSERT INTO users VALUES ('legacy','legacy@example.com','hash',NULL)");
membership.initializeMembership(db);
const adminMembers=load('app/lib/admin-members.ts');
adminMembers.initializeAdminMembers(db);
const socialLinks=load('app/lib/public-social-links.ts');
socialLinks.initializePublicSocialLinks(db);
const cookieJar=new Map();
const auth=load('app/lib/auth.ts',{
  './membership':membership,'./admin-members':adminMembers,'./public-social-links':socialLinks,'better-sqlite3':function(){return db;},'node:fs':{mkdirSync(){}},jose,
  'next/headers':{cookies:async()=>({get:key=>cookieJar.has(key) ? {value:cookieJar.get(key)} : undefined,set:(key,value)=>cookieJar.set(key,value),delete:key=>cookieJar.delete(key)})},
});
const http=load('app/lib/auth-http.ts');
const mails=[];
const verificationMails=[];
let mailFails=false;
class MailConfigError extends Error {}
const mail={approvalMailConfig:()=>({to:'owner@example.com'}),ApprovalMailConfigurationError:MailConfigError,sendApprovalEmail:async(email,token,hash)=>{mails.push({email,token,hash});if(mailFails)throw new Error('provider unavailable');},sendEmailVerificationEmail:async(email,token,hash)=>{verificationMails.push({email,token,hash});if(mailFails)throw new Error('provider unavailable');}};
const deps={'@/app/lib/auth':auth,'@/app/lib/auth-http':http,'@/app/lib/approval-mail':mail};
const adminRoute=load('app/api/admin/members/route.ts',{...deps,'@/app/lib/admin-members':adminMembers});
const socialRoute=load('app/api/public-social-links/route.ts',{...deps,'@/app/lib/public-social-links':socialLinks,'node:crypto':{randomUUID:()=>`social-${Math.random()}`}});
const register=load('app/api/auth/register/route.ts',deps);
const verifyEmail=load('app/api/auth/verify-email/route.ts',deps);
const login=load('app/api/auth/login/route.ts',deps);
const approval=load('app/api/auth/approval/route.ts',deps);
let requestId=0;
const req=(body,origin='http://localhost',ip)=>new Request('http://localhost/api/auth/test',{method:'POST',headers:{'content-type':'application/json',origin,'x-real-ip':ip??`test-${++requestId}`},body:JSON.stringify(body)});
const password='Test-passphrase-123!';
after(()=>db.close());

test('migration preserves old access, defaults future users to pending and is repeatable',()=>{
  assert.equal(db.prepare("SELECT status FROM users WHERE id='legacy'").get().status,'approved');
  assert.equal(db.prepare("SELECT role, access_enabled FROM users WHERE id='legacy'").get().role,'member');
  assert.equal(db.prepare("SELECT access_enabled FROM users WHERE id='legacy'").get().access_enabled,1);
  assert.deepEqual(db.prepare("SELECT registration_ip, last_login_ip FROM users WHERE id='legacy'").get(),{registration_ip:null,last_login_ip:null});
  db.prepare('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)').run('new','new@example.com','hash');
  membership.initializeMembership(db);
  adminMembers.initializeAdminMembers(db);
  assert.equal(db.prepare("SELECT status FROM users WHERE id='new'").get().status,'pending');
  assert.equal(db.prepare("SELECT role, access_enabled FROM users WHERE id='new'").get().role,'member');
});
test('public member count includes only approved enabled member accounts',()=>{
  assert.equal(auth.getActiveMemberCount(),1);
  db.exec("INSERT INTO users(id,email,password_hash,status,role,access_enabled) VALUES ('pending-count','pending-count@example.com','hash','pending','member',1),('disabled-count','disabled-count@example.com','hash','approved','member',0),('admin-count','admin-count@example.com','hash','approved','admin',1)");
  assert.equal(auth.getActiveMemberCount(),1);
});
test('social link storage validates HTTPS URLs and supports add/remove',()=>{
  assert.deepEqual(socialLinks.listPublicSocialLinks(db),[]);
  const first=socialLinks.addPublicSocialLink(db,'telegram','https://t.me/nrbtccambodia',()=> 'social-one');
  assert.equal(first.platform,'telegram');
  assert.equal(socialLinks.listPublicSocialLinks(db)[0].url,'https://t.me/nrbtccambodia');
  for(const [platform,url] of [['unknown','https://example.com'],['instagram','javascript:alert(1)'],['instagram','https://user:pass@example.com']]) {
    assert.throws(()=>socialLinks.addPublicSocialLink(db,platform,url,()=> 'invalid'),socialLinks.PublicSocialLinkError);
  }
  assert.deepEqual(socialLinks.removePublicSocialLink(db,first.id),{id:'social-one'});
  assert.deepEqual(socialLinks.listPublicSocialLinks(db),[]);
});
test('IP capture accepts valid trusted proxy addresses and ignores untrusted forwarding headers',()=>{
  assert.equal(auth.getClientIp(new Request('http://localhost',{headers:{'x-real-ip':'2001:db8::1'}})),'2001:db8::1');
  assert.equal(auth.getClientIp(new Request('http://localhost',{headers:{'x-real-ip':'not-an-ip','x-forwarded-for':'198.51.100.10'}})),null);
});
test('registration notifies only admin, creates no session; pending login and session creation fail',async()=>{
  const response=await register.POST(req({email:'applicant@example.com',password},'http://localhost','198.51.100.10'));
  assert.equal(response.status,202);assert.equal((await response.json()).status,'verification_required');
  assert.equal(cookieJar.size,0);assert.equal(verificationMails.at(-1).email,'applicant@example.com');
  const member=auth.getUserByEmail('applicant@example.com');
  assert.equal(member.status,'pending');assert.equal(member.email_verified,0);
  assert.equal(db.prepare('SELECT registration_ip FROM users WHERE id=?').get(member.id).registration_ip,'198.51.100.10');
  assert.equal((await login.POST(req({email:member.email,password}))).status,403);
  await assert.rejects(auth.createSession(member),/approval/);
  assert.equal(db.prepare('SELECT * FROM membership_reviews WHERE user_id=?').get(member.id),undefined);
  assert.equal(db.prepare('SELECT delivery FROM email_verifications WHERE user_id=?').get(member.id).delivery,'sent');
});
test('review inspection is read-only; explicit approval permits login and token cannot be replayed',async()=>{
  const verificationToken=verificationMails.at(-1).token;
  assert.equal((await verifyEmail.POST(req({token:verificationToken}))).status,200);
  assert.equal(auth.getUserByEmail('applicant@example.com').email_verified,1);
  assert.equal(mails.at(-1).email,'applicant@example.com');
  const record=db.prepare('SELECT * FROM membership_reviews WHERE user_id=?').get(auth.getUserByEmail('applicant@example.com').id);
  assert.equal(record.recipient,'owner@example.com');assert.equal(record.delivery,'sent');
  assert.equal((await verifyEmail.POST(req({token:verificationToken}))).status,410);
  const token=mails.at(-1).token;
  const inspect=await approval.POST(req({token,action:'inspect'}));assert.equal(inspect.status,200);
  assert.equal(auth.getUserByEmail('applicant@example.com').status,'pending');
  assert.equal((await approval.POST(req({token,action:'approved'},'https://evil.example'))).status,403);
  assert.equal((await approval.POST(req({token,action:'approved'}))).status,200);
  assert.equal((await approval.POST(req({token,action:'rejected'}))).status,410);
  assert.equal((await login.POST(req({email:'applicant@example.com',password},'http://localhost','203.0.113.42'))).status,200);
  assert.equal(db.prepare('SELECT last_login_ip FROM users WHERE email=?').get('applicant@example.com').last_login_ip,'203.0.113.42');
  assert.equal((await auth.getCurrentUser()).email,'applicant@example.com');
  db.prepare("UPDATE users SET status='rejected' WHERE email=?").run('applicant@example.com');
  assert.equal(await auth.getCurrentUser(),null);cookieJar.clear();
});
test('expired, superseded and rejected requests cannot grant access',()=>{
  const user=auth.createUser('reject@example.com','hash');
  const first=membership.issueReview(db,user.id,'owner@example.com',1000);
  assert.equal(membership.reviewDetails(db,first.token,1000+72*60*60*1000),null);
  const second=membership.issueReview(db,user.id,'owner@example.com',2000);
  assert.equal(membership.decideReview(db,first.token,'approved',2001),false);
  assert.equal(membership.decideReview(db,second.token,'rejected',2001),true);
  assert.equal(membership.decideReview(db,second.token,'approved',2002),false);
  assert.equal(auth.getUserByEmail(user.email).status,'rejected');
});
test('email failure keeps pending; authenticated retry resends without changing the password',async()=>{
  mailFails=true;
  assert.equal((await register.POST(req({email:'retry@example.com',password}))).status,503);
  const user=auth.getUserByEmail('retry@example.com'),oldToken=verificationMails.at(-1).token;
  assert.equal(user.status,'pending');assert.equal(user.email_verified,0);assert.equal(cookieJar.size,0);
  mailFails=false;
  assert.equal((await register.POST(req({email:user.email,password:'Wrong-password-123!'}))).status,409);
  assert.equal((await register.POST(req({email:user.email,password}))).status,202);
  assert.equal(auth.getUserByEmail(user.email).password_hash,user.password_hash);
  assert.equal((await verifyEmail.POST(req({token:oldToken}))).status,410);
  assert.equal((await verifyEmail.POST(req({token:verificationMails.at(-1).token}))).status,200);
});
test('missing mail configuration fails before creating an account',async()=>{
  const blocked=load('app/api/auth/register/route.ts',{...deps,'@/app/lib/approval-mail':{...mail,approvalMailConfig:()=>{throw new MailConfigError();}}});
  assert.equal((await blocked.POST(req({email:'unconfigured@example.com',password}))).status,503);
  assert.equal(auth.getUserByEmail('unconfigured@example.com'),undefined);
});

test('mail transport sends private review only to configured owner and never to applicant',async()=>{
  const vars={RESEND_API_KEY:'test-key',APPROVAL_EMAIL_FROM:'Edikiter <owner@example.com>',APPROVAL_ADMIN_EMAIL:'admin@example.com',APP_BASE_URL:'https://members.example.com'};
  const previous=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));
  Object.assign(process.env,vars);
  try {
    let sent;
    const sender=load('app/lib/approval-mail.ts',{__fetch:async(url,options)=>{sent={url,...options};return Response.json({id:'test'});}});
    await sender.sendApprovalEmail('applicant@example.com','private-token','request-id');
    assert.equal(sent.url,'https://api.resend.com/emails');
    const body=JSON.parse(sent.body);
    assert.deepEqual(body.to,['admin@example.com']);assert.ok(body.text.includes('https://members.example.com/membership-review#private-token'));
    assert.equal(sent.headers['Idempotency-Key'],'membership/request-id');
    await sender.sendEmailVerificationEmail('applicant@example.com','verify-token','verification-id');
    const verificationBody=JSON.parse(sent.body);
    assert.deepEqual(verificationBody.to,['applicant@example.com']);
    assert.ok(verificationBody.text.includes('https://members.example.com/verify-email#verify-token'));
    assert.equal(sent.headers['Idempotency-Key'],'email-verification/verification-id');
    const failing=load('app/lib/approval-mail.ts',{__fetch:async()=>new Response('',{status:500})});
    await assert.rejects(failing.sendApprovalEmail('applicant@example.com','private-token','request-id'));
    process.env.APP_BASE_URL='https://members.example.com?redirect=bad';
    assert.throws(()=>sender.approvalMailConfig());
  } finally {
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});

test('admin dashboard restricts access and manages membership and immediate access revocation',async()=>{
  const memberPassword=await auth.hashPassword(password);
  const pending=auth.createUser('managed@example.com',memberPassword);
  assert.equal((await adminRoute.GET()).status,401);
  const ordinary=auth.createUser('ordinary@example.com',memberPassword);
  db.prepare("UPDATE users SET status='approved' WHERE id=?").run(ordinary.id);
  await auth.createSession(ordinary);
  const nonAdminResponse=await adminRoute.GET();
  assert.equal(nonAdminResponse.status,403);

  const administrator=auth.createUser('administrator@example.com',memberPassword);
  db.prepare("UPDATE users SET status='approved', role='admin' WHERE id=?").run(administrator.id);
  await auth.createSession(administrator);
  const listing=await adminRoute.GET();
  assert.equal(listing.status,200);
  const listBody=await listing.json();
  assert.ok(listBody.members.some(item=>item.id===pending.id));
  const applicant=listBody.members.find(item=>item.email==='applicant@example.com');
  assert.equal(applicant.registrationIp,'198.51.100.10');
  assert.equal(applicant.lastLoginIp,'203.0.113.42');
  assert.ok(!JSON.stringify(listBody).includes(memberPassword));

  const approve=await adminRoute.PATCH(req({userId:pending.id,action:'approve'}));
  assert.equal(approve.status,200);
  assert.equal(auth.getUserByEmail(pending.email).status,'approved');
  assert.equal((await adminRoute.PATCH(req({userId:pending.id,action:'approve'}))).status,409);
  const unverified=auth.createUser('unverified@example.com',memberPassword,null,false);
  assert.equal((await adminRoute.PATCH(req({userId:unverified.id,action:'approve'}))).status,409);

  const rejectTarget=auth.createUser('reject-by-admin@example.com',memberPassword);
  assert.equal((await adminRoute.PATCH(req({userId:rejectTarget.id,action:'reject'}))).status,200);
  assert.equal(auth.getUserByEmail(rejectTarget.email).status,'rejected');
  assert.equal((await adminRoute.PATCH(req({userId:administrator.id,action:'disable'}))).status,403);

  await auth.createSession(pending);
  const memberSession=cookieJar.get('market_session');
  await auth.createSession(administrator);
  assert.equal((await adminRoute.PATCH(req({userId:pending.id,action:'disable'}))).status,200);
  assert.equal((await login.POST(req({email:pending.email,password}))).status,403);
  cookieJar.set('market_session',memberSession);
  assert.equal(await auth.getCurrentUser(),null);
  await auth.createSession(administrator);
  assert.equal((await adminRoute.PATCH(req({userId:pending.id,action:'enable'}))).status,200);
  assert.equal(auth.getUserByEmail(pending.email).access_enabled,1);
  const refreshed=await adminRoute.GET();
  const refreshedBody=await refreshed.json();
  assert.ok(refreshedBody.audit.some(item=>item.action==='disable'&&item.targetEmail===pending.email));
  assert.ok(refreshedBody.audit.some(item=>item.action==='enable'&&item.targetEmail===pending.email));
});
test('public social-link endpoint is public to read but restricted to administrators for changes',async()=>{
  cookieJar.clear();
  assert.equal((await socialRoute.GET()).status,200);
  assert.equal((await socialRoute.POST(req({platform:'instagram',url:'https://instagram.com/example'}))).status,401);
  const member=auth.createUser('social-member@example.com',await auth.hashPassword(password));
  db.prepare("UPDATE users SET status='approved' WHERE id=?").run(member.id);
  await auth.createSession(member);
  assert.equal((await socialRoute.POST(req({platform:'instagram',url:'https://instagram.com/example'}))).status,403);
  const admin=auth.createUser('social-admin@example.com',await auth.hashPassword(password));
  db.prepare("UPDATE users SET status='approved',role='admin' WHERE id=?").run(admin.id);
  await auth.createSession(admin);
  const added=await socialRoute.POST(req({platform:'instagram',url:'https://instagram.com/example'}));
  assert.equal(added.status,201);
  const {link}=await added.json();
  assert.equal((await socialRoute.GET()).status,200);
  assert.ok((await (await socialRoute.GET()).json()).links.some(item=>item.id===link.id));
  assert.equal((await socialRoute.DELETE(req({id:link.id},'https://evil.example'))).status,403);
  assert.equal((await socialRoute.DELETE(req({id:link.id}))).status,200);
});
test('market and forex endpoints reject requests without an approved session',async()=>{
  for(const file of ['app/api/market/route.ts','app/api/forex/route.ts']){
    const route=load(file,{'@/app/lib/auth':{getCurrentUser:async()=>null},'../../strategy':{},__fetch:async()=>{throw new Error('Must not fetch private market data');}});
    assert.equal((await route.GET(new Request('http://localhost/api/market'))).status,401);
  }
});

test('Gmail uses TLS, strips App Password spaces and sends only to the owner',async()=>{
  const values={APPROVAL_MAIL_PROVIDER:'gmail',GMAIL_USER:'sender@gmail.com',GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop',APPROVAL_ADMIN_EMAIL:'owner@gmail.com',APP_BASE_URL:'https://members.example.com'};
  const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
  let settings,message,closed=false;
  const smtp={createTransport:options=>{settings=options;return {sendMail:async mail=>{message=mail;return {accepted:['owner@gmail.com']};},close:()=>{closed=true;}};}};
  try {
    const sender=load('app/lib/approval-mail.ts',{nodemailer:smtp,__fetch:async()=>{throw new Error('Must not call Resend');}});
    await sender.sendApprovalEmail('applicant@example.com','token','id');
    assert.equal(settings.host,'smtp.gmail.com');assert.equal(settings.port,465);assert.equal(settings.secure,true);
    assert.equal(settings.auth.pass,'abcdefghijklmnop');assert.equal(settings.debug,false);
    assert.equal(message.from,'sender@gmail.com');assert.deepEqual(message.to,['owner@gmail.com']);assert.equal(closed,true);
    process.env.GMAIL_APP_PASSWORD='';assert.throws(()=>sender.approvalMailConfig());
    process.env.GMAIL_APP_PASSWORD=values.GMAIL_APP_PASSWORD;process.env.GMAIL_USER='sender@gmail,com';assert.throws(()=>sender.approvalMailConfig());
    process.env.GMAIL_USER=values.GMAIL_USER;
    const rejected=load('app/lib/approval-mail.ts',{nodemailer:{createTransport:()=>({sendMail:async()=>{throw new Error('sensitive credential details');},close(){}})}});
    await assert.rejects(rejected.sendApprovalEmail('applicant@example.com','token','id'),error=>error.message==='Approval email could not be sent.');
  } finally {for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
