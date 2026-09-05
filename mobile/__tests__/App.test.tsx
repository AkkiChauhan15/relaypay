/**
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/bootstrap', () => ({
  initializeRelayPayWallet: jest.fn().mockResolvedValue(undefined),
}));

test('renders the RelayPay placeholder', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const text = renderer!.root
    .findAllByType(Text)
    .map(node => node.props.children);

  expect(text).toContain('RelayPay');
});
