import {
  crypto_aead_xchacha20poly1305_ietf_decrypt,
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  crypto_aead_xchacha20poly1305_ietf_keygen,
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  crypto_box_keypair,
  crypto_box_seal,
  crypto_box_seal_open,
  crypto_sign_detached,
  crypto_sign_keypair,
  crypto_sign_verify_detached,
  from_base64,
  randombytes_buf,
  ready,
  to_base64,
  to_string,
} from 'react-native-libsodium';

import {
  SodiumCryptoProvider,
  type SodiumBindings,
} from './SodiumCryptoProvider';

const bindings: SodiumBindings = {
  crypto_aead_xchacha20poly1305_ietf_decrypt,
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  crypto_aead_xchacha20poly1305_ietf_keygen,
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  crypto_box_keypair,
  crypto_box_seal,
  crypto_box_seal_open,
  crypto_sign_detached,
  crypto_sign_keypair,
  crypto_sign_verify_detached,
  from_base64,
  randombytes_buf,
  ready,
  to_base64,
  to_string,
};

export const reactNativeCryptoProvider = new SodiumCryptoProvider(bindings);
