const { BluetoothGATTServer } = require('bluetooth-gatt-server');

// 聊天服务UUID
const CHAT_SERVICE_UUID = '00001234-0000-1000-8000-00805f9b34fb';
const CHAT_CHARACTERISTIC_UUID = '00001235-0000-1000-8000-00805f9b34fb';

class BluetoothChatServer {
  constructor() {
    this.server = null;
    this.connectedDevices = new Set();
    this.messageHistory = [];
  }

  async start() {
    try {
      console.log('🚀 启动蓝牙聊天服务器...');
      
      // 创建GATT服务器
      this.server = new BluetoothGATTServer();
      
      // 创建聊天服务
      const chatService = this.server.createService(CHAT_SERVICE_UUID);
      
      // 创建聊天特征
      const chatCharacteristic = chatService.createCharacteristic(
        CHAT_CHARACTERISTIC_UUID,
        {
          properties: ['read', 'write', 'notify'],
          value: Buffer.from('欢迎使用BT Talk!')
        }
      );

      // 处理消息写入
      chatCharacteristic.on('write', (device, value) => {
        const message = value.toString('utf8');
        console.log(`📨 收到来自 ${device.address} 的消息: ${message}`);
        
        // 广播消息给所有连接的设备
        this.broadcastMessage(message, device.address);
        
        // 保存消息历史
        this.messageHistory.push({
          from: device.address,
          message,
          timestamp: new Date()
        });
      });

      // 启动服务器
      await this.server.start();
      
      console.log('✅ 蓝牙聊天服务器已启动');
      console.log(`📱 设备名称: BT Talk Server`);
      console.log(`🔗 服务UUID: ${CHAT_SERVICE_UUID}`);
      console.log('等待客户端连接...');
      
    } catch (error) {
      console.error('❌ 启动服务器失败:', error);
    }
  }

  broadcastMessage(message, fromDevice) {
    this.connectedDevices.forEach(device => {
      if (device.address !== fromDevice) {
        try {
          // 发送消息给其他设备
          device.sendNotification(CHAT_CHARACTERISTIC_UUID, Buffer.from(message));
        } catch (error) {
          console.error(`发送消息到 ${device.address} 失败:`, error);
        }
      }
    });
  }

  stop() {
    if (this.server) {
      this.server.stop();
      console.log('🛑 蓝牙聊天服务器已停止');
    }
  }
}

// 启动服务器
const server = new BluetoothChatServer();
server.start();

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.stop();
  process.exit(0);
}); 