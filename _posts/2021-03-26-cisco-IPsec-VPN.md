---
layout: post
title: "思科路由器IPSec vpn配置"
subtitle: "Hello World, Hello Blog"
author: "Haike Nan"
tags: 
  - Cisco
  - 思科
  - 路由器
  - IPSec
  - VPN
---

###### 拓扑图：

![](/assets/img/IPSecvpn.png)

###### 配置命令：

以R1为例，R3同理。

```
crypto isakmp policy 10
 encr aes 256
 authentication pre-share
 group 5
 lifetime 3600
 !!!!!!!!!!定义策略组
crypto isakmp key 6 CCIE address 202.0.23.3
!!!!!!!!!!定义认证方法
!
crypto ipsec transform-set MYSET esp-aes 256 esp-sha-hmac
 mode tunnel
!!!!!!!!!!!!定义封装方法和模式
!
!
crypto map MYMAP 11 ipsec-isakmp
 set peer 202.0.23.3
 set transform-set MYSET
 match address 102
!!!!!!!!!!!!定义crypto map
!
!
!
!
interface Ethernet0/0
 ip address 202.0.12.1 255.255.255.0
 crypto map MYMAP
!!!!!!!!应用crypto map
interface Ethernet0/1
 ip address 192.168.1.254 255.255.255.0
!
interface Ethernet0/2
 no ip address
 shutdown
!
interface Ethernet0/3
 no ip address
 shutdown
!
router ospf 1
 router-id 1.1.1.1
 network 202.0.12.1 0.0.0.0 area 0
!
ip forward-protocol nd
!
!
no ip http server
no ip http secure-server
ip nat inside source list 101 interface Ethernet0/0 overload
ip route 0.0.0.0 0.0.0.0 202.0.12.2
!
!
!
access-list 101 deny   ip 192.168.1.0 0.0.0.255 192.168.3.0 0.0.0.255
access-list 101 permit ip any any
!!!!!!!!将VPN流量从NAT中剔除
access-list 102 permit ip 192.168.1.0 0.0.0.255 192.168.3.0 0.0.0.255
!!!!!!!!匹配感兴趣流
```

