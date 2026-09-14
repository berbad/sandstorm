// Only the byte parsing and equality operations needed by the SSRF filter.
// ipaddr.js replaces the unmaintained ip package without using isPublic().
const ipaddr = require("ipaddr.js");

module.exports = {
  toBuffer(address) {
    return Buffer.from(ipaddr.parse(address).toByteArray());
  },
  isEqual(left, right) {
    const a = ipaddr.process(left);
    const b = ipaddr.process(right);
    return a.kind() === b.kind() && a.toByteArray().every((value, i) => value === b.toByteArray()[i]);
  },
};
