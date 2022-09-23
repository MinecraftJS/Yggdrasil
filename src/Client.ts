import { parseUUID, UUID } from '@minecraft-js/uuid';
import { URLSearchParams } from 'node:url';
import {
  EmptyResponseError,
  InsufficientPrivilegesError,
  UserBannedError,
} from './utils/errors';
import { generateHexDigest } from './utils/hash';
import { request } from './utils/request';

export class YggdrasilClient {
  /** Default instance using the default host */
  public static readonly instance = new YggdrasilClient();
  /** Headers to apply to every single requests */
  public static readonly HEADERS = {
    'User-Agent':
      'MinecraftJS/1.0.0 (https://github.com/MinecraftJS/Yggdrasil)',
    'Content-Type': 'application/json',
  };

  /** Host this instance is bound to */
  public readonly host: string;

  public constructor(host?: string) {
    this.host = host ?? 'https://sessionserver.mojang.com';
  }

  public async join(
    accessToken: string,
    selectedProfile: UUID,
    serverId: string,
    sharedSecret: Buffer,
    serverPublicKey: Buffer
  ): Promise<void> {
    const hash = generateHexDigest(serverId, sharedSecret, serverPublicKey);

    const { body, response } = await request(
      this.host + '/session/minecraft/join',
      JSON.stringify({
        accessToken,
        selectedProfile,
        serverId: hash,
      }),
      {
        headers: YggdrasilClient.HEADERS,
        method: 'POST',
      }
    );

    switch (response.statusCode) {
      case 204:
        return;

      case 403:
        const error = JSON.parse(body.toString()).error;

        switch (error) {
          case 'InsufficientPrivilegesException':
            throw new InsufficientPrivilegesError(
              'Xbox profile has multiplayer disabled'
            );

          case 'UserBannedException':
            throw new UserBannedError('User is banned from multiplayer');

          default:
            throw new Error(error);
        }

      default:
        throw new Error('Unexpected status code ' + response.statusCode);
    }
  }

  /**
   * Ask the authentication server if an online player connected to the server
   *
   * Note: The `id` and `name` fields are then sent back to the client using a Login Success packet. The profile id in the
   * json response has format `11111111222233334444555555555555` which needs to be changed into format
   * `11111111-2222-3333-4444-555555555555` before sending it back to the client.
   *
   * @param username The username is case insensitive and must match the client's username (which was received in the LoginStartPacket).
   * Note that this is the in-game nickname of the selected profile, not the Mojang account name (which is never sent to the server).
   * Servers should use the name sent in the "name" field.
   * @param serverId ASCII encoding of the server id string from EncryptionRequestPacket
   * @param sharedSecret Shared secret between the client and the server
   * @param serverPublicKey Server's public key from EncryptionRequestPacket
   * @param ip The ip field is optional and when present should be the IP address of the connecting player; it is the one that
   * originally initiated the session request. The notchian server includes this only when `prevent-proxy-connections`
   * is set to true in `server.properties`.
   * @returns Object containing the UUID and the player's skin
   */
  public async hasJoined(
    username: string,
    serverId: string,
    sharedSecret: Buffer,
    serverPublicKey: Buffer,
    ip?: string
  ): Promise<HasJoinedResponse> {
    const hash = generateHexDigest(serverId, sharedSecret, serverPublicKey);

    const params = new URLSearchParams();
    params.set('username', username);
    params.set('serverId', hash);
    if (ip) params.set('ip', ip);

    const { body, response } = await request(
      this.host + '/session/minecraft/hasJoined?' + params.toString(),
      null,
      {
        headers: {
          'User-Agent': YggdrasilClient.HEADERS['User-Agent'],
        },
      }
    );

    switch (response.statusCode) {
      case 200:
        const parsed = JSON.parse(body.toString());
        parsed.id = parseUUID(parsed.id);
        return parsed;

      case 204:
        throw new EmptyResponseError(
          'Received an empty response from the server'
        );

      default:
        throw new Error('Unexpected status code ' + response.statusCode);
    }
  }
}

export const yggdrasil = YggdrasilClient.instance;

export interface HasJoinedResponse {
  id: UUID;
  name: string;
  properties: {
    name: string;
    value: string;
    signature: string;
  }[];
}
