# BT Talk iOS App

iOS原生蓝牙聊天应用，支持Core Bluetooth框架。

## 功能特点

- 基于iOS Core Bluetooth框架
- 支持BLE设备发现和连接
- 实时消息收发
- 原生iOS界面设计
- 支持后台运行

## 开发环境

- Xcode 14+
- iOS 13.0+
- Swift 5.0+

## 安装步骤

1. 克隆项目
2. 在Xcode中打开 `BTTalk.xcodeproj`
3. 选择你的开发者账号
4. 构建并运行到设备上

## 使用说明

1. 打开应用
2. 点击"开始广播"或"搜索设备"
3. 选择要连接的设备
4. 开始聊天

## 权限配置

在 `Info.plist` 中添加蓝牙权限：

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>此应用需要使用蓝牙来与其他设备进行聊天</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>此应用需要使用蓝牙来与其他设备进行聊天</string>
```

## 技术架构

- **Core Bluetooth** - 蓝牙通信
- **SwiftUI** - 用户界面
- **Combine** - 数据绑定
- **Foundation** - 基础功能 