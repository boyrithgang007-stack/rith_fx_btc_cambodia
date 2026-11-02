"use client";

import { useAppTheme } from "./ThemeControls";
import { setAppTheme } from "./theme-store";

export default function ThemePreferences() {
  const theme = useAppTheme();
  return <article className="settings-card appearance-settings-card">
    <div className="settings-card-heading"><div><p className="eyebrow">APPEARANCE / TWO MODES</p><h2>រូបរាងប្រព័ន្ធ</h2><p>ជម្រើសតែមួយសម្រាប់គ្រប់ទំព័រ៖ អក្សរ ពណ៌ ក្រឡា និងប៊ូតុង។</p></div></div>
    <fieldset className="theme-preferences"><legend>ជ្រើសរើសរបៀបបង្ហាញ</legend>
      {(["light","dark"] as const).map(mode=><label key={mode} className={`theme-choice ${theme===mode?"is-selected":""}`}>
        <input type="radio" name="app-theme" value={mode} checked={theme===mode} onChange={()=>setAppTheme(mode)}/>
        <span className={`theme-choice-preview preview-${mode}`} aria-hidden="true"><i/><span><b/><b/><b/></span></span>
        <strong>{mode==="light"?"របៀបធម្មតា":"របៀបងងឹត"}</strong>
        <small>{mode==="light"?"ផ្ទៃស អក្សរខ្មៅ បៃតង តាមទំព័រដើម":"ផ្ទៃ Navy ពន្លឺ Cyan/Green តាម Overview"}</small>
      </label>)}
    </fieldset><p className="settings-hint">អនុវត្តភ្លាមៗ និងរក្សាទុកក្នុង browser នេះ។</p>
  </article>;
}
