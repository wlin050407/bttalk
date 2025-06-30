import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// 聊天服务UUID - 专门为网页聊天设计
const CHAT_SERVICE_UUID = '00001234-0000-1000-8000-00805f9b34fb';
const CHAT_CHARACTERISTIC_UUID = '00001235-0000-1000-8000-00805f9b34fb';

// 生成唯一的用户ID
const generateUserId = () => {
  return 'user_' + Math.random().toString(36).substr(2, 9);
};

// 检测浏览器兼容性
const checkBrowserCompatibility = () => {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
  const isEdge = /Edge/.test(userAgent);
  const isOpera = /Opera|OPR/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  
  const hasWebBluetooth = 'bluetooth' in navigator;
  
  // iOS上的所有浏览器都不支持Web Bluetooth API
  const isSupported = hasWebBluetooth && (isChrome || isEdge || isOpera) && !isIOS;
  
  return {
    isIOS,
    isAndroid,
    isChrome,
    isEdge,
    isOpera,
    isSafari,
    hasWebBluetooth,
    isSupported,
    isMobile: isIOS || isAndroid
  };
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [status, setStatus] = useState('未连接');
  const [deviceName, setDeviceName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [userId] = useState(generateUserId());
  const [browserInfo, setBrowserInfo] = useState(checkBrowserCompatibility());
  
  const bluetoothDevice = useRef(null);
  const bluetoothServer = useRef(null);
  const bluetoothService = useRef(null);
  const bluetoothCharacteristic = useRef(null);
  const messagesEndRef = useRef(null);
  const advertisingInterval = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (text, isReceived = false, from = '系统') => {
    const newMessage = {
      id: Date.now(),
      text,
      isReceived,
      from,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  // 开始广播自己（让其他用户发现）
  const startAdvertising = async () => {
    try {
      if (!navigator.bluetooth) {
        throw new Error('您的浏览器不支持Web Bluetooth API');
      }

      setStatus('正在启动广播...');
      setIsAdvertising(true);

      // 创建GATT服务器
      bluetoothServer.current = await navigator.bluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [
          {
            namePrefix: 'BT Talk Web'
          }
        ],
        optionalServices: [CHAT_SERVICE_UUID]
      });

      // 创建聊天服务
      const chatService = bluetoothServer.current.createService(CHAT_SERVICE_UUID);
      
      // 创建聊天特征
      const chatCharacteristic = chatService.createCharacteristic(
        CHAT_CHARACTERISTIC_UUID,
        {
          properties: ['read', 'write', 'notify'],
          value: Buffer.from(`BT Talk Web User: ${userId}`)
        }
      );

      // 处理消息写入
      chatCharacteristic.on('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const message = decoder.decode(value);
        addMessage(message, true, '其他用户');
      });

      setStatus('广播中 - 等待其他用户连接');
      addMessage('已开始广播，其他用户可以发现你', false, '系统');

    } catch (error) {
      console.error('启动广播失败:', error);
      setStatus(`广播失败: ${error.message}`);
      addMessage(`广播失败: ${error.message}`, false, '系统');
      setIsAdvertising(false);
    }
  };

  // 搜索其他用户
  const scanForUsers = async () => {
    try {
      setIsScanning(true);
      setStatus('正在搜索其他用户...');
      
      if (!navigator.bluetooth) {
        throw new Error('您的浏览器不支持Web Bluetooth API');
      }

      // 搜索其他BT Talk Web用户
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [
          {
            namePrefix: 'BT Talk Web'
          }
        ],
        optionalServices: [CHAT_SERVICE_UUID]
      });

      if (device) {
        await connectToUser(device);
      }
      
    } catch (error) {
      console.error('搜索失败:', error);
      if (error.name === 'NotFoundError') {
        setStatus('未找到其他用户，请确保其他用户已打开此网页');
        addMessage('未找到其他用户。请确保：\n1. 其他用户已打开此网页\n2. 其他用户已开始广播\n3. 设备在蓝牙范围内', false, '系统');
      } else {
        setStatus(`搜索失败: ${error.message}`);
        addMessage(`搜索失败: ${error.message}`, false, '系统');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // 连接到其他用户
  const connectToUser = async (device) => {
    try {
      setStatus('正在连接...');
      setDeviceName(device.name || '未知用户');

      // 连接到GATT服务器
      bluetoothServer.current = await device.gatt.connect();
      
      setStatus('正在获取服务...');
      
      // 获取聊天服务
      bluetoothService.current = await bluetoothServer.current.getPrimaryService(CHAT_SERVICE_UUID);
      
      setStatus('正在获取特征...');
      
      // 获取聊天特征
      bluetoothCharacteristic.current = await bluetoothService.current.getCharacteristic(CHAT_CHARACTERISTIC_UUID);
      
      // 订阅通知
      await bluetoothCharacteristic.current.startNotifications();
      bluetoothCharacteristic.current.addEventListener('characteristicvaluechanged', handleReceivedMessage);
      
      bluetoothDevice.current = device;
      setIsConnected(true);
      setStatus('已连接');
      addMessage(`成功连接到 ${device.name || '其他用户'}！`, false, '系统');
      
      // 添加到已连接用户列表
      setConnectedPeers(prev => [...prev, { id: device.id, name: device.name }]);
      
    } catch (error) {
      console.error('连接失败:', error);
      setStatus(`连接失败: ${error.message}`);
      addMessage(`连接失败: ${error.message}`, false, '系统');
    }
  };

  // 自动搜索模式
  const startAutoSearch = async () => {
    try {
      setStatus('自动搜索模式已启动');
      addMessage('自动搜索模式已启动，将定期搜索其他用户', false, '系统');
      
      // 每30秒搜索一次
      const searchInterval = setInterval(async () => {
        if (!isConnected && !isScanning) {
          try {
            await scanForUsers();
          } catch (error) {
            console.log('自动搜索失败:', error);
          }
        }
      }, 30000);

      // 保存interval引用以便清理
      advertisingInterval.current = searchInterval;
      
    } catch (error) {
      console.error('启动自动搜索失败:', error);
    }
  };

  const disconnect = () => {
    if (bluetoothDevice.current && bluetoothDevice.current.gatt.connected) {
      bluetoothDevice.current.gatt.disconnect();
    }
    
    bluetoothDevice.current = null;
    bluetoothServer.current = null;
    bluetoothService.current = null;
    bluetoothCharacteristic.current = null;
    
    setIsConnected(false);
    setIsAdvertising(false);
    setStatus('已断开连接');
    setDeviceName('');
    setConnectedPeers([]);
    addMessage('蓝牙连接已断开', false, '系统');

    // 清理定时器
    if (advertisingInterval.current) {
      clearInterval(advertisingInterval.current);
      advertisingInterval.current = null;
    }
  };

  const handleReceivedMessage = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const message = decoder.decode(value);
    addMessage(message, true, deviceName || '其他用户');
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !isConnected) return;

    try {
      const encoder = new TextEncoder();
      const messageData = encoder.encode(inputMessage);
      
      await bluetoothCharacteristic.current.writeValue(messageData);
      addMessage(inputMessage, false, '我');
      setInputMessage('');
    } catch (error) {
      console.error('发送消息失败:', error);
      addMessage(`发送失败: ${error.message}`, false, '系统');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (advertisingInterval.current) {
        clearInterval(advertisingInterval.current);
      }
    };
  }, []);

  // 如果不支持Web Bluetooth API，显示兼容性提示
  if (!browserInfo.isSupported) {
    return (
      <div className="App">
        <div className="container">
          <header className="header">
            <h1>BT Talk Web</h1>
            <p>基于网页的蓝牙聊天</p>
          </header>

          <div className="compatibility-warning">
            <div className="warning-icon">!</div>
            <h2>浏览器兼容性提示</h2>
            
            {browserInfo.isIOS ? (
              <div className="ios-warning">
                <h3>iOS设备检测到</h3>
                <p>iOS系统限制：所有iOS浏览器都不支持Web Bluetooth API</p>
                <p>解决方案：</p>
                <ul>
                  <li>使用Android设备</li>
                  <li>使用桌面设备（Windows/Mac/Linux）</li>
                  <li>下载原生iOS应用（需要开发者账号）</li>
                  <li>使用其他聊天应用</li>
                </ul>
                <div className="download-links">
                  <a href="https://play.google.com/store/apps/details?id=com.android.chrome" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    下载Chrome for Android
                  </a>
                  <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                    下载Chrome桌面版
                  </a>
                </div>
              </div>
            ) : (
              <div className="general-warning">
                <p>您的浏览器不支持Web Bluetooth API</p>
                <p>支持的平台和浏览器：</p>
                <ul>
                  <li>Chrome 56+ (桌面版/Android)</li>
                  <li>Edge 79+ (桌面版/Android)</li>
                  <li>Opera 43+ (桌面版/Android)</li>
                </ul>
                <p><strong>注意：iOS设备不支持Web Bluetooth API</strong></p>
                <p>请使用支持的浏览器访问此应用</p>
              </div>
            )}

            <div className="browser-info">
              <h4>当前浏览器信息：</h4>
              <p>设备类型: {browserInfo.isMobile ? '移动设备' : '桌面设备'}</p>
              <p>操作系统: {browserInfo.isIOS ? 'iOS' : browserInfo.isAndroid ? 'Android' : '其他'}</p>
              <p>浏览器: {browserInfo.isChrome ? 'Chrome' : browserInfo.isEdge ? 'Edge' : browserInfo.isOpera ? 'Opera' : browserInfo.isSafari ? 'Safari' : '其他'}</p>
              <p>Web Bluetooth支持: {browserInfo.hasWebBluetooth ? '是' : '否'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <div className="header-content">
            <div className="header-left">
              <h1>BT Talk Web</h1>
              <div className="user-id">ID: {userId}</div>
            </div>
            <div className="header-right">
              <div className="status-badge">
                <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                {status}
              </div>
            </div>
          </div>
        </header>

        <div className="main-content">
          <div className="sidebar">
            <div className="connection-controls">
              {!isConnected && !isAdvertising ? (
                <div className="button-group">
                  <button 
                    onClick={startAdvertising} 
                    className="btn btn-primary"
                    disabled={isScanning}
                  >
                    开始广播
                  </button>
                  <button 
                    onClick={scanForUsers} 
                    className="btn btn-secondary"
                    disabled={isScanning}
                  >
                    {isScanning ? '搜索中...' : '搜索用户'}
                  </button>
                  <button 
                    onClick={startAutoSearch} 
                    className="btn btn-outline"
                    disabled={isScanning}
                  >
                    自动搜索
                  </button>
                </div>
              ) : (
                <button onClick={disconnect} className="btn btn-danger">
                  断开连接
                </button>
              )}
            </div>

            {connectedPeers.length > 0 && (
              <div className="peers-section">
                <h3>已连接 ({connectedPeers.length})</h3>
                <div className="peers-list">
                  {connectedPeers.map(peer => (
                    <div key={peer.id} className="peer-item">
                      <div className="peer-avatar"></div>
                      <span className="peer-name">{peer.name || '未知用户'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="chat-area">
            <div className="chat-header">
              <h2>{deviceName || '聊天'}</h2>
              {isConnected && <span className="online-indicator">在线</span>}
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"></div>
                  <h3>开始聊天</h3>
                  <p>连接其他用户开始聊天</p>
                </div>
              ) : (
                <div className="messages">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message ${message.isReceived ? 'received' : 'sent'}`}
                    >
                      <div className="message-content">
                        {message.from !== '我' && message.from !== '系统' && (
                          <div className="message-sender">{message.from}</div>
                        )}
                        <div className="message-text">{message.text}</div>
                        <div className="message-time">{message.timestamp}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="input-container">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息..."
                disabled={!isConnected}
                className="message-input"
              />
              <button
                onClick={sendMessage}
                disabled={!isConnected || !inputMessage.trim()}
                className="send-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 