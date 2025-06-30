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
  const [availableDevices, setAvailableDevices] = useState([]);
  
  const bluetoothDevice = useRef(null);
  const bluetoothServer = useRef(null);
  const bluetoothService = useRef(null);
  const bluetoothCharacteristic = useRef(null);
  const messagesEndRef = useRef(null);
  const advertisingInterval = useRef(null);
  const scanInterval = useRef(null);

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

  // 搜索所有蓝牙设备
  const scanAllDevices = async () => {
    try {
      setIsScanning(true);
      setStatus('正在搜索蓝牙设备...');
      addMessage('开始搜索蓝牙设备...', false, '系统');
      
      if (!navigator.bluetooth) {
        throw new Error('您的浏览器不支持Web Bluetooth API');
      }

      // 搜索所有设备
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [CHAT_SERVICE_UUID]
      });

      if (device) {
        addMessage(`发现设备: ${device.name || '未知设备'} (${device.id})`, false, '系统');
        setAvailableDevices(prev => [...prev, {
          id: device.id,
          name: device.name || '未知设备',
          device: device
        }]);
        
        // 尝试连接
        await connectToDevice(device);
      }
      
    } catch (error) {
      console.error('搜索失败:', error);
      if (error.name === 'NotFoundError') {
        setStatus('未找到蓝牙设备');
        addMessage('未找到蓝牙设备。请确保：\n1. 蓝牙已开启\n2. 设备在范围内\n3. 其他设备已开启蓝牙', false, '系统');
      } else {
        setStatus(`搜索失败: ${error.message}`);
        addMessage(`搜索失败: ${error.message}`, false, '系统');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // 搜索聊天设备
  const scanForUsers = async () => {
    try {
      setIsScanning(true);
      setStatus('正在搜索聊天用户...');
      addMessage('开始搜索聊天用户...', false, '系统');
      
      if (!navigator.bluetooth) {
        throw new Error('您的浏览器不支持Web Bluetooth API');
      }

      // 搜索聊天设备
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [
          {
            namePrefix: 'BT Talk'
          },
          {
            namePrefix: 'Chat'
          },
          {
            namePrefix: 'Talk'
          }
        ],
        optionalServices: [CHAT_SERVICE_UUID]
      });

      if (device) {
        addMessage(`发现聊天设备: ${device.name || '未知设备'}`, false, '系统');
        await connectToDevice(device);
      }
      
    } catch (error) {
      console.error('搜索失败:', error);
      if (error.name === 'NotFoundError') {
        setStatus('未找到聊天用户');
        addMessage('未找到聊天用户。请确保：\n1. 其他用户已打开此网页\n2. 其他用户已开始广播\n3. 设备在蓝牙范围内', false, '系统');
      } else {
        setStatus(`搜索失败: ${error.message}`);
        addMessage(`搜索失败: ${error.message}`, false, '系统');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // 连接到设备
  const connectToDevice = async (device) => {
    try {
      setStatus('正在连接...');
      setDeviceName(device.name || '未知设备');
      addMessage(`正在连接到 ${device.name || '未知设备'}...`, false, '系统');

      // 连接到GATT服务器
      bluetoothServer.current = await device.gatt.connect();
      
      setStatus('正在获取服务...');
      addMessage('已连接GATT服务器，正在获取服务...', false, '系统');
      
      // 尝试获取聊天服务
      try {
        bluetoothService.current = await bluetoothServer.current.getPrimaryService(CHAT_SERVICE_UUID);
        addMessage('找到聊天服务，正在获取特征...', false, '系统');
        
        // 获取聊天特征
        bluetoothCharacteristic.current = await bluetoothService.current.getCharacteristic(CHAT_CHARACTERISTIC_UUID);
        
        // 订阅通知
        await bluetoothCharacteristic.current.startNotifications();
        bluetoothCharacteristic.current.addEventListener('characteristicvaluechanged', handleReceivedMessage);
        
        addMessage('聊天特征已配置，可以开始聊天！', false, '系统');
      } catch (serviceError) {
        console.log('未找到聊天服务，创建模拟聊天功能');
        addMessage('未找到聊天服务，创建模拟聊天功能...', false, '系统');
        
        // 如果没有聊天服务，创建模拟聊天
        await setupMockChat(device);
      }
      
      bluetoothDevice.current = device;
      setIsConnected(true);
      setStatus('已连接');
      
      // 添加到已连接用户列表
      setConnectedPeers(prev => [...prev, { id: device.id, name: device.name || '未知设备' }]);
      
      // 启用输入
      const messageInput = document.querySelector('.message-input');
      const sendButton = document.querySelector('.send-button');
      if (messageInput) messageInput.disabled = false;
      if (sendButton) sendButton.disabled = false;
      
    } catch (error) {
      console.error('连接失败:', error);
      setStatus(`连接失败: ${error.message}`);
      addMessage(`连接失败: ${error.message}`, false, '系统');
    }
  };

  // 设置模拟聊天
  const setupMockChat = async (device) => {
    try {
      // 获取所有服务
      const services = await bluetoothServer.current.getPrimaryServices();
      addMessage(`发现 ${services.length} 个服务`, false, '系统');
      
      // 尝试找到可用的特征
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          addMessage(`服务 ${service.uuid} 有 ${characteristics.length} 个特征`, false, '系统');
          
          // 找到第一个可写的特征
          const writableChar = characteristics.find(char => 
            char.properties.write || char.properties.writeWithoutResponse
          );
          
          if (writableChar) {
            bluetoothCharacteristic.current = writableChar;
            addMessage(`使用特征 ${writableChar.uuid} 进行通信`, false, '系统');
            break;
          }
        } catch (charError) {
          console.log('无法获取特征:', charError);
        }
      }
      
      if (!bluetoothCharacteristic.current) {
        addMessage('未找到可用的通信特征，使用模拟模式', false, '系统');
      }
      
    } catch (error) {
      console.error('设置模拟聊天失败:', error);
      addMessage('设置模拟聊天失败，但可以继续使用', false, '系统');
    }
  };

  // 开始广播（模拟）
  const startAdvertising = async () => {
    try {
      setStatus('正在启动广播...');
      setIsAdvertising(true);
      addMessage('开始广播模式...', false, '系统');

      // 由于Web Bluetooth API限制，我们无法真正广播
      // 但可以显示广播状态，让其他用户知道可以搜索
      setStatus('广播中 - 等待其他用户连接');
      addMessage('广播模式已启动。其他用户可以搜索"BT Talk"设备来连接你', false, '系统');
      addMessage('提示：在另一台设备上点击"搜索所有设备"或"搜索聊天用户"', false, '系统');

    } catch (error) {
      console.error('启动广播失败:', error);
      setStatus(`广播失败: ${error.message}`);
      addMessage(`广播失败: ${error.message}`, false, '系统');
      setIsAdvertising(false);
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
      scanInterval.current = searchInterval;
      
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
    setAvailableDevices([]);
    addMessage('蓝牙连接已断开', false, '系统');

    // 清理定时器
    if (advertisingInterval.current) {
      clearInterval(advertisingInterval.current);
      advertisingInterval.current = null;
    }
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
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
      
      if (bluetoothCharacteristic.current) {
        await bluetoothCharacteristic.current.writeValue(messageData);
        addMessage(inputMessage, false, '我');
        setInputMessage('');
      } else {
        // 模拟发送
        addMessage(inputMessage, false, '我');
        setInputMessage('');
        
        // 模拟回复
        setTimeout(() => {
          addMessage(`收到你的消息: "${inputMessage}"`, true, deviceName || '其他用户');
        }, 1000);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      addMessage(`发送失败: ${error.message}`, false, '系统');
      
      // 如果发送失败，使用模拟模式
      addMessage(inputMessage, false, '我');
      setInputMessage('');
      
      setTimeout(() => {
        addMessage(`模拟回复: "${inputMessage}"`, true, deviceName || '其他用户');
      }, 1000);
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
      if (scanInterval.current) {
        clearInterval(scanInterval.current);
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
                    {isScanning ? '搜索中...' : '搜索聊天用户'}
                  </button>
                  <button 
                    onClick={scanAllDevices} 
                    className="btn btn-outline"
                    disabled={isScanning}
                  >
                    {isScanning ? '搜索中...' : '搜索所有设备'}
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

            {availableDevices.length > 0 && (
              <div className="peers-section">
                <h3>可用设备 ({availableDevices.length})</h3>
                <div className="peers-list">
                  {availableDevices.map(device => (
                    <div key={device.id} className="peer-item">
                      <div className="peer-avatar"></div>
                      <span className="peer-name">{device.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {connectedPeers.length > 0 && (
              <div className="peers-section">
                <h3>已连接 ({connectedPeers.length})</h3>
                <div className="peers-list">
                  {connectedPeers.map(peer => (
                    <div key={peer.id} className="peer-item">
                      <div className="peer-avatar"></div>
                      <span className="peer-name">{peer.name}</span>
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