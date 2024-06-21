import React, {useEffect, useState} from 'react';
import {View, Text, Button, StyleSheet} from 'react-native';
import Interfone from '../interfone';

const webSocketServer = 'ws://fs.dev.ppacontatto.com.br:5066';
const target = 'sip:joao@sipjs.onsip.com';

const HomeScreen = ({navigation}: {navigation: any}) => {
  const [interfone, setInterfone] = useState<Interfone | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const interfoneInstance = Interfone.getInstance({
      webSocketServer: 'ws://fs.dev.ppacontatto.com.br:5066',
      username: 'fernanda',
      password: '1234',
      navigation: navigation,
    });
    interfoneInstance
      .initialize()
      .then(() => {
        console.log('Initialization successful');
        setInterfone(interfoneInstance);
      })
      .catch(error => console.error('Initialization failed:', error));
  }, [navigation]);

  const handleConnect = () => {
    if (interfone) {
      interfone
        .connect()
        .then(() => {
          console.log('Connected successfully');
          setConnected(true);
        })
        .catch(error => console.error('Connection failed:', error));
    }
  };

  const handleDisconnect = () => {
    if (interfone) {
      interfone.disconnect();
      setConnected(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Bem Vindo!</Text>
      {/* {callStatus && <Text>{callStatus}</Text>} */}
      <Text>WebSocket Server: {webSocketServer}</Text>
      <Text>Target: {target}</Text>
      <Button title="Connect" onPress={handleConnect} disabled={connected} />
      <Button
        title="Disconnect"
        onPress={handleDisconnect}
        disabled={!connected}
      />

      <Button
        title="Fazer Chamada"
        onPress={() => navigation.navigate('IncomingCall')}
        disabled={!connected}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcomeText: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
});

export default HomeScreen;
