import React from 'react';
import {View, Text, Button} from 'react-native';

interface IncomingCallProps {
  navigation: {
    navigate: (route: string) => void;
  };
}

const IncomingCall: React.FC<IncomingCallProps> = ({navigation}) => {
  return (
    <View>
      <Text>Chamada Recebida</Text>
      <Button title="Atender" onPress={() => navigation.navigate('InCall')} />
      <Button
        title="Rejeitar"
        onPress={() => {
          /* Rejeitar chamada */
        }}
      />
    </View>
  );
};

export default IncomingCall;
