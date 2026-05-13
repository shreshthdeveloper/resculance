const mediasoup = require('mediasoup');

class MediasoupService {
  constructor() {
    this.worker = null;
    this.routers = new Map();
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.peers = new Map();
  }

  async initialize() {
    try {
      this.worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT, 10) || 40000,
        rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT, 10) || 49999
      });
      console.log('✅ Mediasoup worker created [pid:%d]', this.worker.pid);

      this.worker.on('died', () => {
        console.error('❌ Mediasoup worker died, exiting in 2 seconds...');
        setTimeout(() => process.exit(1), 2000);
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to create mediasoup worker:', error);
      return false;
    }
  }

  async getRouter(sessionId) {
    if (this.routers.has(sessionId)) return this.routers.get(sessionId);

    const router = await this.worker.createRouter({
      mediaCodecs: [
        { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
        { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 1000 } },
        {
          kind: 'video', mimeType: 'video/H264', clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000
          }
        }
      ]
    });
    this.routers.set(sessionId, router);
    return router;
  }

  async getRtpCapabilities(sessionId) {
    const router = await this.getRouter(sessionId);
    return router.rtpCapabilities;
  }

  async createWebRtcTransport(sessionId, userId) {
    const router = await this.getRouter(sessionId);
    const transport = await router.createWebRtcTransport({
      listenIps: [{
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1'
      }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true
    });

    const peerKey = `${sessionId}_${userId}`;
    if (!this.peers.has(peerKey)) {
      this.peers.set(peerKey, { transports: [], producers: [], consumers: [] });
    }
    this.peers.get(peerKey).transports.push(transport.id);
    this.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    };
  }

  async connectTransport(transportId, dtlsParameters) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);
    await transport.connect({ dtlsParameters });
  }

  async produce(transportId, kind, rtpParameters, sessionId, userId) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);
    const producer = await transport.produce({ kind, rtpParameters });
    const peerKey = `${sessionId}_${userId}`;
    if (!this.peers.has(peerKey)) this.peers.set(peerKey, { transports: [], producers: [], consumers: [] });
    this.peers.get(peerKey).producers.push(producer.id);
    this.producers.set(producer.id, { producer, sessionId, userId, kind });
    return producer.id;
  }

  async consume(transportId, producerId, rtpCapabilities, sessionId, userId) {
    const transport = this.transports.get(transportId);
    const producerInfo = this.producers.get(producerId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);
    if (!producerInfo) throw new Error(`Producer ${producerId} not found`);

    const router = await this.getRouter(sessionId);
    if (!router.canConsume({ producerId, rtpCapabilities })) return null;

    const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
    const peerKey = `${sessionId}_${userId}`;
    if (!this.peers.has(peerKey)) this.peers.set(peerKey, { transports: [], producers: [], consumers: [] });
    this.peers.get(peerKey).consumers.push(consumer.id);
    this.consumers.set(consumer.id, { consumer, sessionId, userId });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused
    };
  }

  async resumeConsumer(consumerId) {
    const info = this.consumers.get(consumerId);
    if (!info) throw new Error(`Consumer ${consumerId} not found`);
    await info.consumer.resume();
  }

  async pauseConsumer(consumerId) {
    const info = this.consumers.get(consumerId);
    if (!info) throw new Error(`Consumer ${consumerId} not found`);
    await info.consumer.pause();
  }

  getProducersInSession(sessionId, excludeUserId) {
    const producers = [];
    const seen = new Set();
    for (const [producerId, info] of this.producers.entries()) {
      if (info.sessionId === sessionId && info.userId !== excludeUserId) {
        const key = `${info.userId}_${info.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        producers.push({ producerId, userId: info.userId, kind: info.kind });
      }
    }
    return producers;
  }

  async cleanupPeer(sessionId, userId) {
    const peerKey = `${sessionId}_${userId}`;
    const peer = this.peers.get(peerKey);
    if (!peer) return;

    for (const transportId of peer.transports) {
      const transport = this.transports.get(transportId);
      if (transport) {
        transport.close();
        this.transports.delete(transportId);
      }
    }
    for (const producerId of peer.producers) this.producers.delete(producerId);
    for (const consumerId of peer.consumers) this.consumers.delete(consumerId);
    this.peers.delete(peerKey);
  }

  async cleanupSession(sessionId) {
    const router = this.routers.get(sessionId);
    if (router) {
      router.close();
      this.routers.delete(sessionId);
    }
    const toRemove = [];
    for (const peerKey of this.peers.keys()) {
      if (peerKey.startsWith(`${sessionId}_`)) toRemove.push(peerKey);
    }
    for (const peerKey of toRemove) {
      const userId = peerKey.split('_')[1];
      await this.cleanupPeer(sessionId, userId);
    }
  }
}

module.exports = new MediasoupService();
