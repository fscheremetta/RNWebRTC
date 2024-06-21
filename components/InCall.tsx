import React from 'react';
import {View, Text, Button} from 'react-native';

const InCall = () => {
  return (
    <View>
      <Text>Em Chamada</Text>
      <Button
        title="Desligar"
        onPress={() => {
          /* Desligar chamada */
        }}
      />
    </View>
  );
};

export default InCall;
