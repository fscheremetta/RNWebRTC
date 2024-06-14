import CheckBox from '@react-native-community/checkbox';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Button,
  Alert,
  StyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {mediaDevices, registerGlobals} from 'react-native-webrtc';
import {UserAgent, Inviter, Registerer} from 'sip.js';
import InCallManager from 'react-native-incall-manager';

registerGlobals();

const webSocketServer = 'ws://fs.dev.ppacontatto.com.br:5066';
const target = 'sip:joao@sipjs.onsip.com';
const displayName = 'SIP js';

const App = () => {
  const [connected, setConnected] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [incomingSession, setIncomingSession] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const registerer = useRef(null);
  const userAgent = useRef(null);
  let currentSession = useRef(null);

  useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone to make calls.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    };

    requestPermission().then(granted => {
      if (granted) {
        console.warn('Microphone permission granted');
      } else {
        console.warn('Microphone permission denied');
      }
    });

    const userAgentOptions = {
      uri: UserAgent.makeURI(`sip:fernanda@fs.dev.ppacontatto.com.br`),
      transportOptions: {
        server: webSocketServer,
      },
      authorizationUsername: 'fernanda',
      authorizationPassword: '1234',
      displayName: displayName,
    };

    userAgent.current = new UserAgent(userAgentOptions);

    userAgent.current.delegate = {
      onInvite: invitation => {
        invitation.sessionDescriptionHandlerOptions = {
          constraints: {
            audio: true,
          },
          RTCOfferOptions: {
            offerToReceiveAudio: true,
          },
        };
        console.error('Chamador:', invitation.remoteIdentity.displayName);

        InCallManager.vibrate = true;
        setIncomingCall(true);
        setIncomingSession(invitation);
      },
    };
  }, []);

  const connect = useCallback(() => {
    console.warn('[connect click]');
    userAgent.current
      .start()
      .then(() => {
        registerer.current = new Registerer(userAgent.current);
        return registerer.current.register();
      })
      .then(() => {
        setConnected(true);
      })
      .catch(error => {
        console.error(`[${userAgent.current.id}] failed to connect`, error);
        Alert.alert('Failed to connect', error.message);
      });
  }, [userAgent, registerer]);

  const disconnect = () => {
    if (currentSession.current) {
      currentSession.current.bye().catch(error => {
        console.error(`[${userAgent.current.id}] failed to hangup call`, error);
        Alert.alert('Failed to hangup call', error.message);
      });
      InCallManager.setKeepScreenOn(false);
      setCallActive(false);
    }

    if (registerer.current) {
      registerer.current.unregister().then(() => {
        userAgent.current.stop().then(() => {
          InCallManager.stop();
          setConnected(false);
        });
      });
    }
  };

  const acceptCall = () => {
    if (incomingSession) {
      currentSession.current = incomingSession;
      setupSession(currentSession.current);

      setupSession(incomingSession);
      incomingSession
        .accept()
        .then(() => {
          InCallManager.start({media: 'audio'});
          InCallManager.setForceSpeakerphoneOn(false);
          InCallManager.setKeepScreenOn(true);
          InCallManager.vibrate = false;
          setCallActive(true);
          setIncomingCall(false);
        })
        .catch(error => {
          console.error('Falha ao aceitar chamada', error);
          Alert.alert('Falha ao aceitar chamada', error.message);
        });
    }
  };

  const rejectCall = () => {
    if (incomingSession) {
      incomingSession
        .reject()
        .then(() => {
          console.log('Chamada rejeitada');
          setIncomingCall(false);
          InCallManager.vibrate = false;
        })
        .catch(error => {
          console.error('Falha ao rejeitar chamada', error);
          Alert.alert('Falha ao rejeitar chamada', error.message);
        });
    }
  };

  const call = () => {
    const inviter = new Inviter(userAgent.current, UserAgent.makeURI(target), {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
        },
        RTCOfferOptions: {
          offerToReceiveAudio: true,
        },
      },
    });

    currentSession.current = inviter;
    setupSession(inviter);
    inviter.invite().catch(error => {
      console.error(`[${userAgent.current.id}] failed to place call`, error);
      Alert.alert('Failed to place call', error.message);
    });
  };

  const hangup = () => {
    if (currentSession.current) {
      currentSession.current.bye().catch(error => {
        console.error(`[${userAgent.current.id}] failed to hangup call`, error);
        Alert.alert('Failed to hangup call', error.message);
      });

      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
        setLocalStream(null);
      }
      InCallManager.setKeepScreenOn(false);
      InCallManager.stop();
      setCallActive(false);
    }
  };

  const setupSession = async session => {
    const localStream = await mediaDevices.getUserMedia({
      audio: true,
    });
    setLocalStream(localStream);

    session.stateChange.addListener(state => {
      console.error(`[${userAgent.current.id}] state: ${state}`);
      if (state.toLowerCase() === 'established') {
        setCallStatus('Chamada estabelecida');
        setCallActive(true);
        setMuted(false);
      } else if (state.toLowerCase() === 'terminated') {
        setCallStatus('Chamada encerrada');
        setCallActive(false);
        setMuted(false);
        currentSession.current = null;
        setCallStatus('');
      } else if (state.toLowerCase() === 'establishing') {
        setCallStatus('Chamando...');
      }
    });
  };

  const handleMute = checked => {
    const audioTracks = localStream.getAudioTracks();
    console.log('Muting:', checked);
    audioTracks.forEach(track => {
      console.log('Before mute toggle:', track.enabled);
      track.enabled = !checked;
      console.log('After mute toggle:', track.enabled);
    });
    setMuted(checked);

    if (currentSession.current) {
      currentSession.current.invite();
      console.log('Renegotiation triggered');
    }
  };

  const handleSpeaker = async checked => {
    console.log('Speaker toggled:', checked);
    setSpeaker(checked);
    try {
      if (checked) {
        InCallManager.setForceSpeakerphoneOn(true);
        console.log('Speaker is on');
      } else {
        InCallManager.setForceSpeakerphoneOn(false);
        console.log('Speaker is off');
      }
    } catch (error) {
      console.error('Error toggling speaker:', error);
    }
  };

  return (
    <View style={styles.container}>
      {incomingCall && (
        <View>
          <Button title="Aceitar" onPress={acceptCall} />
          <Button title="Recusar" onPress={rejectCall} />
        </View>
      )}
      {callStatus && <Text>{callStatus}</Text>}
      <Text>WebSocket Server: {webSocketServer}</Text>
      <Text>Target: {target}</Text>
      <Button title="Connect" onPress={connect} disabled={connected} />
      <Button title="Call" onPress={call} disabled={!connected || callActive} />
      <Button title="Hangup" onPress={hangup} disabled={!callActive} />
      <Button title="Disconnect" onPress={disconnect} disabled={!connected} />
      <CheckBox
        value={muted}
        onValueChange={handleMute}
        disabled={!callActive}
      />
      <Text>Mute</Text>
      <CheckBox
        value={speaker}
        onValueChange={handleSpeaker}
        disabled={!callActive}
      />
      <Text>Speaker</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
