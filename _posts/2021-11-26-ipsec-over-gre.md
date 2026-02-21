---
layout: post
title: "思科路由器配置ipsec over gre"
subtitle: "Hello World, Hello Blog"
author: "Haike Nan"
tags: 
  - Cisco
  - 思科
  - 路由器
  - IPSec
  - gre
  - vpn
---


##### 拓扑：

![](/assets/img/ipsec-over-gre.png)

##### 配置：

R1：

```
!
hostname R1
!
crypto isakmp policy 10
 encr aes 256
 authentication pre-share
 group 5
 lifetime 3600
!定义策略
crypto isakmp key 6 CCIE address 202.0.23.3     
!定义认证方法
!
crypto ipsec transform-set MYSET esp-aes 256 esp-sha-hmac 
 mode transport
!定义转换极和封装模式
crypto ipsec profile MYPRO
 set transform-set MYSET 
!定义ipsec保护文件和引入转换极
!
interface Tunnel0
 no shutdown
 ip address 192.168.100.1 255.255.255.252
 tunnel source 202.0.12.1
 tunnel destination 202.0.23.3
 tunnel protection ipsec profile MYPRO
!定义tunnel地址、tunnel源地址、tunnel目的地址，调用ipsec保护文件
interface Ethernet0/0
 no shutdown
 ip address 192.168.1.254 255.255.255.0
!
interface Ethernet0/1
 no shutdown
 ip address 202.0.12.1 255.255.255.0
!
ip route 0.0.0.0 0.0.0.0 202.0.12.2
ip route 192.168.2.0 255.255.255.0 192.168.100.2
!

```



R2：

```
!
interface Ethernet0/0
 no shutdown
 ip address 202.0.12.2 255.255.255.0
!
interface Ethernet0/1
 no shutdown
 ip address 202.0.23.2 255.255.255.0
!
```



R3:

```
!
crypto isakmp policy 10
 encr aes 256
 authentication pre-share
 group 5
 lifetime 3600
crypto isakmp key 6 CCIE address 202.0.12.1     
!
!
crypto ipsec transform-set MYSET esp-aes 256 esp-sha-hmac 
 mode transport
!
crypto ipsec profile MYPRO
 set transform-set MYSET 
!
interface Tunnel0
 no shutdown
 ip address 192.168.100.2 255.255.255.252
 tunnel source 202.0.23.3
 tunnel destination 202.0.12.1
 tunnel protection ipsec profile MYPRO
!
interface Ethernet0/0
 no shutdown
 ip address 202.0.23.3 255.255.255.0
!
interface Ethernet0/1
 no shutdown
 ip address 192.168.2.254 255.255.255.0
!
ip route 0.0.0.0 0.0.0.0 202.0.23.2
ip route 192.168.1.0 255.255.255.0 192.168.100.1
!

```

本实验所用模拟器为PNET。
