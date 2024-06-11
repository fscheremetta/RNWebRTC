import CheckBox from '@react-native-community/checkbox';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, Button, Alert, StyleSheet} from 'react-native';
import {
  RTCPeerConnection,
  mediaDevices,
  registerGlobals,
  MediaStream,
  RTCView,
} from 'react-native-webrtc';
import {UserAgent, Invitation, Inviter, Registerer} from 'sip.js';

registerGlobals();

const webSocketServer = 'wss://edge.sip.onsip.com';
const target = 'sip:echo@sipjs.onsip.com';
const displayName = 'SIP js';

const App = () => {
  const [connected, setConnected] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const userAgent = useRef(null);
  const registerer = useRef(null);
  let currentSession = useRef(null);

  useEffect(() => {
    const userAgentOptions = {
      uri: UserAgent.makeURI(`sip:aline@sipjs.onsip.com`),
      transportOptions: {
        server: webSocketServer,
      },
      authorizationUsername: 'echo',
      authorizationPassword: '',
      displayName: displayName,
    };

    userAgent.current = new UserAgent(userAgentOptions);

    userAgent.current.delegate = {
      onInvite: invitation => {
        currentSession.current = invitation;
        handleIncomingCall(invitation);
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
    if (registerer.current) {
      registerer.current.unregister().then(() => {
        userAgent.current.stop().then(() => {
          setConnected(false);
        });
      });
    }
  };

  const call = () => {
    const inviter = new Inviter(userAgent.current, UserAgent.makeURI(target));
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
      setCallActive(false);
    }
  };

  const handleIncomingCall = invitation => {
    setupSession(invitation);
    invitation.accept().catch(error => {
      console.error(`[${userAgent.current.id}] failed to accept call`, error);
      Alert.alert('Failed to accept call', error.message);
    });
    setCallActive(true);
  };

  const setupSession = async session => {
    session.stateChange.addListener(state => {
      console.error(`[${userAgent.current.id}] state: ${state}`);
      if (state.toLowerCase() === 'established') {
        // Get the remote stream and play it
        // const remoteStream = new MediaStream();
        // peerConnection.current.getReceivers().forEach(receiver => {
        //   console.warn('[RECEIVER]', receiver);
        //   remoteStream.addTrack(receiver.track);
        // });
        // setRemoteStream(remoteStream);
      } else if (state.toLowerCase() === 'terminated') {
        setCallActive(false);
        setOnHold(false);
        setMuted(false);
        currentSession.current = null;
      }
    });

    session.delegate = {
      onTrack: (track, streams) => {
        console.log('[STREAMS ON TRACK', streams, track);
        setRemoteStream(streams[0]);
      },
    };

    const localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    console.error('Local Stream:', localStream);
  };

  const handleHold = async checked => {
    if (checked) {
      await currentSession.current.hold();
      setOnHold(true);
    } else {
      await currentSession.current.unhold();
      setOnHold(false);
    }
  };

  const handleMute = checked => {
    if (checked) {
      // peerConnection.current
      //   .getSenders()
      //   .forEach(sender => (sender.track.enabled = false));
      setMuted(true);
    } else {
      // peerConnection.current
      //   .getSenders()
      //   .forEach(sender => (sender.track.enabled = true));
      setMuted(false);
    }
  };
  console.warn(remoteStream);
  return (
    <View style={styles.container}>
      <Text>WebSocket Server: {webSocketServer}</Text>
      <Text>Target: {target}</Text>
      <Button title="Connect" onPress={connect} disabled={connected} />
      <Button title="Call" onPress={call} disabled={!connected || callActive} />
      <Button title="Hangup" onPress={hangup} disabled={!callActive} />
      <Button title="Disconnect" onPress={disconnect} disabled={!connected} />
      <CheckBox
        value={onHold}
        onValueChange={handleHold}
        disabled={!callActive}
      />
      <Text>Hold</Text>
      <CheckBox
        value={muted}
        onValueChange={handleMute}
        disabled={!callActive}
      />
      <Text>Mute</Text>
      {/* Element to handle audio stream */}
      {remoteStream && <RTCView streamURL={remoteStream.toURL()} />}
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
