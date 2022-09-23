/**
 * Most of the code here
 * is just adapted to fit
 * my needs
 * @see https://gist.github.com/andrewrk/4425843?permalink_comment_id=3265398#gistcomment-3265398
 * for the original code
 */

import { createHash } from 'node:crypto';

/**
 * Generate a server hash from its serverId, shared secret and public key
 * @param serverId ASCII encoding of the server id string from EncryptionRequestPacket
 * @param sharedSecret Shared secret between the client and the server
 * @param serverPublicKey Server's public key from EncryptionRequestPacket
 * @returns The hash
 */
export function generateHexDigest(
  serverId: string,
  sharedSecret: Buffer,
  serverPublicKey: Buffer
): string {
  // The hex digest is the hash made below.
  // However, when this hash is negative (meaning its MSB is 1, as it is in two's complement), instead of leaving it
  // like that, we make it positive and simply put a '-' in front of it. This is a simple process: as you always do
  // with 2's complement you simply flip all bits and add 1

  let hash = createHash('sha1')
    .update(serverId)
    .update(sharedSecret)
    .update(serverPublicKey)
    .digest();

  // Negative check: check if the most significant bit of the hash is a 1.
  const isNegative = (hash.readUInt8(0) & (1 << 7)) !== 0; // when 0, it is positive

  if (isNegative) {
    // Flip all bits and add one. Start at the right to make sure the carry works
    const inverted = Buffer.allocUnsafe(hash.length);
    let carry = 0;
    for (let i = hash.length - 1; i >= 0; i--) {
      let num = hash.readUInt8(i) ^ 0b11111111; // a byte XOR a byte of 1's = the inverse of the byte
      if (i === hash.length - 1) num++;
      num += carry;
      carry = Math.max(0, num - 0b11111111);
      num = Math.min(0b11111111, num);
      inverted.writeUInt8(num, i);
    }
    hash = inverted;
  }
  let result = hash.toString('hex').replace(/^0+/, '');
  // If the result was negative, add a '-' sign
  if (isNegative) result = `-${result}`;

  return result;
}
