#!/usr/bin/env node
/*
 * AVARA — turn two-step sign-in OFF from the admin dashboard
 *
 *   Settings > Two-step sign-in now shows a "Turn off two-step sign-in" button while it is ON.
 *   To protect the account, it asks for a current 6-digit code from the authenticator app before switching off.
 *   You can switch it on again at any time with "Set up two-step sign-in".
 *
 * IMPORTANT: if you ran require-mfa-for-admin.sql in Supabase, the database itself refuses admin actions without the
 * code. Turning two-step off then locks the admin pages out of your data until you turn it back on (or remove that rule).
 *
 * Changes only:  admin.html   (no database change)
 * Run from the project root:   node apply-mfa-off-patch.js     then push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');
const count = (t, s) => t.split(s).length - 1;

const HTML_OLD = '        <div style="padding-bottom:18px"><button class="btn" id="mfaStart" type="button" hidden>Set up two-step sign-in</button></div>';
const HTML_NEW = `        <div style="padding-bottom:18px">
          <button class="btn" id="mfaStart" type="button" hidden>Set up two-step sign-in</button>
          <button class="btn btn--danger" id="mfaOff" type="button" hidden>Turn off two-step sign-in</button>
          <div id="mfaOffRow" hidden style="margin-top:12px">
            <p class="hint">Type a current 6-digit code from your authenticator app to confirm. After this, only your password protects the account.</p>
            <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:10px 0 0">
              <label class="field" style="margin:0">6-digit code<input id="mfaOffCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>
              <button class="btn btn--danger" id="mfaOffConfirm" type="button">Turn off</button>
              <button class="btn" id="mfaOffCancel" type="button">Cancel</button>
            </div>
          </div>
        </div>`;

const STATUS_OLD = "      start.hidden = on; $('#mfaEnroll').hidden = true;";
const STATUS_NEW = "      start.hidden = on; $('#mfaOff').hidden = !on; $('#mfaOffRow').hidden = true; $('#mfaEnroll').hidden = true;";

const JS_ANCHOR = '  sb.auth.getSession().then(function(r){';
const JS_NEW = `  $('#mfaOff').addEventListener('click', function(){
    mfaMsg(''); $('#mfaOffRow').hidden = false; $('#mfaOffCode').value = ''; $('#mfaOffCode').focus();
  });
  $('#mfaOffCancel').addEventListener('click', function(){ $('#mfaOffRow').hidden = true; mfaMsg(''); });
  $('#mfaOffConfirm').addEventListener('click', function(){
    var code = $('#mfaOffCode').value.trim(), btn = $('#mfaOffConfirm');
    if(code.length < 6){ mfaMsg('Enter the 6-digit code from the app.', true); return; }
    if(!confirm('Turn off two-step sign-in? Your account will be protected by the password only.')) return;
    btn.disabled = true; mfaMsg('');
    var done = function(){ btn.disabled = false; };
    withTimeout(sb.auth.mfa.listFactors(), 10000).then(function(r){
      var f = r.data && r.data.totp && r.data.totp[0];
      if(r.error || !f){ mfaMsg('Could not find the two-step setup. Reload the page and try again.', true); return; }
      return sb.auth.mfa.challengeAndVerify({factorId: f.id, code: code}).then(function(v){
        if(v.error){ mfaMsg('That code did not work. Check the app and try again.', true); return; }
        return sb.auth.mfa.unenroll({factorId: f.id}).then(function(u){
          if(u.error){ mfaMsg('Could not turn it off: ' + (u.error.message || 'unknown error'), true); return; }
          $('#mfaOffRow').hidden = true; mfaMsg('Two-step sign-in is now off.', false); refreshMfaStatus();
        });
      });
    }).then(done, function(e){ done(); console.error('MFA turn-off failed', e); mfaMsg('Could not turn it off: ' + ((e && e.message === 'timeout') ? 'no response from Supabase.' : ((e && e.message) || 'unknown error')), true); });
  });
  sb.auth.getSession().then(function(r){`;

const file = ['admin.html'].find((f) => fs.existsSync(f));
if (!file) { console.error('Could not find admin.html. Run this from the project root.'); process.exit(1); }
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');
if (t.includes('id="mfaOff"')) { console.log(file + ': already up to date'); process.exit(0); }
const problems = [];
for (const [find, rep] of [[HTML_OLD, HTML_NEW], [STATUS_OLD, STATUS_NEW], [JS_ANCHOR, JS_NEW]]) {
  const n = count(t, find);
  if (n !== 1) { problems.push(file + ': expected 1 match but found ' + n + ' for: ' + find.trim().slice(0, 90)); continue; }
  t = t.replace(find, () => rep);
}
if (problems.length) {
  console.error('Nothing was changed. Please send me admin.html and I will adjust the patch:\n');
  problems.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
fs.writeFileSync(file + '.bak', raw);
fs.writeFileSync(file, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log(file + ': updated (backup saved as ' + file + '.bak)\n\nNext: commit and push, then open Admin > Settings > Two-step sign-in.');
