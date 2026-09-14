const assert = require('assert');
const nodemailer = require('nodemailer');
const xml2js = require('xml2js');
const JSZip = require('jszip');

async function check() {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const mail = await transport.sendMail({ from: 'sender@example.test', to: 'to@example.test', subject: 'Compatibility', text: 'Message body' });
  assert(mail.message.toString().includes('Subject: Compatibility'));
  const parsed = await xml2js.parseStringPromise('<Response><Name>A &amp; B</Name></Response>', { explicitRoot: true });
  assert.deepStrictEqual(parsed.Response.Name, ['A & B']);
  const malicious = await xml2js.parseStringPromise('<Response><__proto__><polluted>true</polluted></__proto__></Response>');
  assert.strictEqual({}.polluted, undefined);
  assert(Object.prototype.hasOwnProperty.call(malicious.Response, '__proto__'));
  const original = new JSZip().file('metadata', '{}').file('data/state', 'saved-value');
  const zip = await JSZip.loadAsync(await original.generateAsync({ type: 'nodebuffer' }));
  assert(zip.file('metadata'));
  assert.strictEqual(await zip.file('data/state').async('string'), 'saved-value');
  console.log('Mail, XML and backup ZIP compatibility checks passed');
}
check().catch(error => { console.error(error); process.exitCode = 1; });
