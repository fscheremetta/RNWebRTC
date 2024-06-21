import {
  UserAgent,
  Inviter,
  Registerer,
  Invitation,
  Session,
  SessionState,
} from 'sip.js';
import {MediaStream, mediaDevices} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import {Platform} from 'react-native';
import {check, PERMISSIONS, request, RESULTS} from 'react-native-permissions';
import {NavigationProp} from '@react-navigation/native';

interface InterfoneOptions {
  webSocketServer: string;
  username: string;
  password: string;
  navigation: NavigationProp<any, any>;
}

class Interfone {
  private static instance: Interfone | null = null;
  private callStatus: string = '';

  private incomingCall: boolean = false;
  private speaker: boolean = false;
  private muted: boolean = false;
  private connected: boolean = false;
  private callActive: boolean = false;

  private incomingSession: Invitation | null = null;
  private localStream: MediaStream | null = null;
  private registerer: Registerer | null = null;
  private userAgent: UserAgent | null = null;
  private currentSession: Session | null = null;

  constructor(private options: InterfoneOptions) {}

  public getUserAgent(): UserAgent | string | null {
    return Interfone.instance ? Interfone.instance.userAgent : 'no tem';
  }

  public static getInstance(options?: InterfoneOptions): Interfone {
    if (!Interfone.instance) {
      if (!options) {
        throw new Error(
          'Interfone instance is not initialized and no options were provided.',
        );
      }
      Interfone.instance = new Interfone(options);
    }
    return Interfone.instance;
  }

  public async initialize(): Promise<void> {
    await this.requestMicrophonePermission();
    this.register();
  }

  public async requestMicrophonePermission(): Promise<boolean> {
    let permissionResult;
    if (Platform.OS === 'ios') {
      permissionResult = await check(PERMISSIONS.IOS.MICROPHONE);

      if (permissionResult === RESULTS.DENIED) {
        permissionResult = await request(PERMISSIONS.IOS.MICROPHONE);
      }
    } else if (Platform.OS === 'android' && Platform.Version >= 33) {
      permissionResult = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
    } else if (Platform.OS === 'android' && Platform.Version < 33) {
      permissionResult = RESULTS.GRANTED;
    }
    console.warn('permissionResult', permissionResult);
    return permissionResult === RESULTS.GRANTED;
  }

  private register(): void {
    const {webSocketServer, username, password} = this.options;
    const userAgentOptions = {
      uri: UserAgent.makeURI(`sip:${username}@${getDomain(webSocketServer)}`),
      transportOptions: {
        server: webSocketServer,
      },
      authorizationUsername: username,
      authorizationPassword: password,
    };

    this.userAgent = new UserAgent(userAgentOptions);

    this.userAgent.delegate = {
      onInvite: (invitation: Invitation) => {
        this.handleIncomingCall(invitation);
        this.options.navigation.navigate('IncomingCall');
      },
    };
  }

  private handleIncomingCall(invitation: Invitation): void {
    invitation.sessionDescriptionHandlerOptions = {
      constraints: {
        audio: true,
      },
    };
    console.error('Chamador:', invitation.remoteIdentity.displayName);
    InCallManager.vibrate = true;
    this.incomingCall = true;
    this.incomingSession = invitation;
  }

  public async connect(): Promise<void> {
    if (!this.userAgent) {
      throw new Error('UserAgent is not initialized');
    }
    try {
      await this.userAgent.start();
      this.connected = true;
      this.registerer = new Registerer(this.userAgent);
      await this.registerer.register();
    } catch (error: any) {
      console.error('Failed to connect:', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.currentSession) {
      await this.currentSession.bye();
      InCallManager.stop();
      InCallManager.setKeepScreenOn(false);
      this.callActive = false;
    }
    if (this.registerer) {
      await this.registerer.unregister();
      await this.userAgent?.stop();
      this.connected = false;
    }
    console.log('Disconnected');
  }

  public async acceptCall(): Promise<void> {
    if (this.incomingSession) {
      this.currentSession = this.incomingSession;
      this.setupSession(this.incomingSession);
      this.incomingSession
        .accept()
        .then(() => {
          InCallManager.start({media: 'audio'});
          InCallManager.setForceSpeakerphoneOn(false);
          InCallManager.setKeepScreenOn(true);
          InCallManager.vibrate = false;
          this.callActive = true;
          this.incomingCall = false;
        })
        .catch(error => {
          console.error('Falha ao aceitar chamada', error);
        });
    }
  }

  public rejectCall() {
    if (this.incomingSession) {
      this.incomingSession
        .reject()
        .then(() => {
          console.log('Chamada rejeitada');
          this.incomingCall = false;
          InCallManager.vibrate = false;
        })
        .catch(error => {
          console.error('Falha ao rejeitar chamada', error);
        });
    }
  }

  private async setupSession(session: Session): Promise<void> {
    await this.requestMicrophonePermission();
    this.localStream = await mediaDevices.getUserMedia({audio: true});

    session.stateChange.addListener((state: SessionState) => {
      if (state.toLowerCase() === 'established') {
        this.callStatus = 'Chamada estabelecida';
        this.callActive = true;
        this.muted = false;
      } else if (state.toLowerCase() === 'terminated') {
        this.callStatus = 'Chamada encerrada';
        this.callActive = false;
        this.muted = false;
        this.currentSession = null;
        this.callStatus = '';
      } else if (state.toLowerCase() === 'establishing') {
        this.callStatus = 'Chamando...';
      }
    });
  }

  public call(target: string) {
    if (this.userAgent) {
      const targetAgent = UserAgent.makeURI(target);
      if (targetAgent) {
        const inviter = new Inviter(this.userAgent, targetAgent, {
          sessionDescriptionHandlerOptions: {
            constraints: {
              audio: true,
            },
          },
        });
        this.currentSession = inviter;
        this.setupSession(inviter);
        inviter.invite().catch(error => {
          console.error('Failed to place call', error);
        });
      }
    }
  }

  public hangup() {
    if (this.currentSession) {
      this.currentSession.bye().catch(error => {
        console.error('Failed to hangup call', error);
      });

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          track.stop();
        });
        this.localStream = null;
      }
      InCallManager.setKeepScreenOn(false);
      InCallManager.stop();
      this.callActive = false;
    }
  }

  public handleMute(checked: boolean) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      console.log('Muting:', checked);
      audioTracks.forEach(track => {
        console.log('Before mute toggle:', track.enabled);
        track.enabled = !checked;
        console.log('After mute toggle:', track.enabled);
      });
      this.muted = checked;

      if (this.currentSession) {
        this.currentSession.invite();
        console.log('Renegotiation triggered');
      }
    }
  }

  public async handleSpeaker(checked: boolean) {
    console.log('Speaker toggled:', checked);
    this.speaker = checked;
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
  }
}

export default Interfone;

function getDomain(domain: string) {
  const regex = /(?<=:\/\/)[^:\/]+/;
  const match = domain.match(regex);
  return match ? match[0] : null;
}
