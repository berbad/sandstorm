const assert = require('assert');
const ip = require('../../shell/imports/server/ip-address');
assert.deepStrictEqual([...ip.toBuffer('127.0.0.1')], [127, 0, 0, 1]);
assert.strictEqual(ip.toBuffer('2001:db8::1').length, 16);
assert(ip.isEqual('2001:db8::1', '2001:0db8:0:0:0:0:0:1'));
assert(ip.isEqual('127.0.0.1', '::ffff:127.0.0.1'));
assert(ip.isEqual('127.0.0.1', '::127.0.0.1'));
assert(!ip.isEqual('127.0.0.1', '127.0.0.2'));
assert.throws(() => ip.toBuffer('not-an-ip'));
console.log('IP address compatibility checks passed');

// Exercise the production filter and real address lists without starting Meteor
// or resolving any external host. Only module loading and synchronous DNS are
// adapted for this standalone Node 14 test.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const constants = fs.readFileSync(path.join(__dirname, '../../shell/imports/constants.js'), 'utf8');
const networking = fs.readFileSync(path.join(__dirname, '../../shell/imports/server/networking.js'), 'utf8');
const stripModules = source => source.replace(/^import .*;\s*$/gm, '').replace(/export\s*\{[^}]*\};/g, '');
let addresses = [];
const context = {
  Ip: ip,
  Url: require('url'),
  Dns: { ADDRCONFIG: 0, lookup: () => addresses },
  Meteor: {
    wrapAsync: fn => fn,
    Error: class MeteorError extends Error {
      constructor(code, message) { super(message); this.error = code; }
    },
  },
  console,
  process: { env: {} },
};
const production = vm.runInNewContext(
  stripModules(constants) + '\n' + stripModules(networking) +
  '\n({ ssrfSafeLookup, PRIVATE_IPV4_ADDRESSES, PRIVATE_IPV6_ADDRESSES })',
  context,
);
const defaultBlacklist = production.PRIVATE_IPV4_ADDRESSES.concat(production.PRIVATE_IPV6_ADDRESSES).join('\n');
const db = { getSettingWithFallback: () => defaultBlacklist };
for (const address of [
  '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
  '::1', 'fc00::1', 'fe80::1%eth0', '::ffff:127.0.0.1', '::127.0.0.1',
  '::ffff:8.8.8.8', '::8.8.8.8', '2130706433', '0x7f000001', '0177.0.0.1',
  '192.0.2.1', '2001:db8::1',
]) {
  addresses = [{ address, family: address.includes(':') ? 6 : 4 }];
  assert.throws(() => production.ssrfSafeLookup(db, 'https://target.example/path'),
    error => error.error === 403, address + ' must be rejected');
}
for (const address of ['8.8.8.8', '2606:4700:4700::1111']) {
  addresses = [{ address, family: address.includes(':') ? 6 : 4 }];
  const result = production.ssrfSafeLookup(db, 'https://target.example/path');
  assert.strictEqual(result.host, 'target.example');
  assert(result.url.includes(address), 'public address remains usable');
}
addresses = [{ address: '127.0.0.1', family: 4 }, { address: '8.8.8.8', family: 4 }];
assert.strictEqual(production.ssrfSafeLookup(db, 'https://target.example/path').url,
  'https://8.8.8.8/path');
console.log('Production SSRF filter checks passed');
