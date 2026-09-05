import { useEffect, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { initializeRelayPayWallet } from './src/bootstrap';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [initializationFailed, setInitializationFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    initializeRelayPayWallet().catch(() => {
      if (mounted) {
        setInitializationFailed(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Text style={styles.title}>RelayPay</Text>
      <Text style={styles.subtitle}>
        {initializationFailed
          ? 'Secure wallet unavailable.'
          : 'Offline payments, coming soon.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    color: '#5D6470',
    fontSize: 16,
    marginTop: 8,
  },
  title: {
    color: '#121820',
    fontSize: 32,
    fontWeight: '700',
  },
});

export default App;
