import {
  SodiumCryptoProvider,
  type SodiumBindings,
} from '../src/crypto/SodiumCryptoProvider';

const sodium = jest.requireActual<typeof import('libsodium-wrappers-sumo')>(
  'libsodium-wrappers-sumo',
);

const requireValue = <T>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error('libsodium is not ready');
  }
  return value;
};

const bindings: SodiumBindings = {
  crypto_aead_xchacha20poly1305_ietf_decrypt: (...args) =>
    sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(...args),
  crypto_aead_xchacha20poly1305_ietf_encrypt: (...args) =>
    sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(...args),
  crypto_aead_xchacha20poly1305_ietf_keygen: () =>
    sodium.crypto_aead_xchacha20poly1305_ietf_keygen(),
  get crypto_aead_xchacha20poly1305_ietf_NPUBBYTES() {
    return requireValue(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  },
  crypto_box_keypair: () => sodium.crypto_box_keypair(),
  crypto_box_seal: (...args) => sodium.crypto_box_seal(...args),
  crypto_box_seal_open: (...args) => sodium.crypto_box_seal_open(...args),
  crypto_sign_detached: (...args) => sodium.crypto_sign_detached(...args),
  crypto_sign_keypair: () => sodium.crypto_sign_keypair(),
  crypto_sign_verify_detached: (...args) =>
    sodium.crypto_sign_verify_detached(...args),
  from_base64: value => sodium.from_base64(value),
  randombytes_buf: length => sodium.randombytes_buf(length),
  ready: sodium.ready,
  to_base64: value => sodium.to_base64(value),
  to_string: value => sodium.to_string(value),
};

export const createNodeCryptoProvider = (): SodiumCryptoProvider =>
  new SodiumCryptoProvider(bindings);
