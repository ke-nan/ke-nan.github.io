---
layout: post
title: "Cisco路由器OSPF邻居状态异常原因汇总"
subtitle: "Hello World, Hello Blog"
author: "Haike Nan"
tags: 
  - Cisco
  - 路由器
  - OSPF
---
实验拓扑：

![](/assets/img/Snipaste_2022-06-06_14-05-10.png)

正常状态（full）下的配置：

R1：

```
interface Loopback0
 ip address 1.1.1.1 255.255.255.255
!
interface Ethernet0/0
 ip address 192.168.12.1 255.255.255.0
!         
router ospf 1
 router-id 1.1.1.1
 network 1.1.1.1 0.0.0.0 area 0
 network 192.168.12.1 0.0.0.0 area 0
```

R2：

```
interface Loopback0
 ip address 2.2.2.2 255.255.255.255
!
interface Ethernet0/0
 ip address 192.168.12.2 255.255.255.0
!
router ospf 1
 router-id 2.2.2.2
 network 2.2.2.2 0.0.0.0 area 0
 network 192.168.12.2 0.0.0.0 area 0
```

R1的邻居状态：

```
R1#show ip ospf neighbor 

Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           1   FULL/DR        00:00:33    192.168.12.2    Ethernet0/0
```

R2的邻居状态：

```
R2#show ip ospf neighbor 

Neighbor ID     Pri   State           Dead Time   Address         Interface
1.1.1.1           1   FULL/BDR         00:00:35    192.168.12.1    Ethernet0/0
```



### 1，接口down

我们将R1的E0/0接口down掉（以下所有改动如未说明，均在R1上进行，R2不做改动）：

```
R1(config)#int e0/0
R1(config-if)#shut
R1(config-if)#
*Jun  6 06:17:59.385: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
```

邻居状态直接变成down。

```
R1#show ip ospf neighbor 
R1#
```

在R2上查看亦然：

```
R2#
*Jun  6 06:24:17.571: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf neighbor 
R2#
```

R2感知不到R1的接口关闭，继续发送hello报文，dead time后未收到回包，触发dead time过期提示，然后邻居状态变为down。

### 2，接口未运行ospf进程

在R1上no掉network语句：

```
R1(config)#router ospf 1
R1(config-router)#no net 192.168.12.1 0.0.0.0 a 0
R1(config-router)#
*Jun  6 06:40:16.851: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
```

邻居状态变为down。

```
R1#show ip ospf neighbor 
R1#
```

在R2上查看其邻居状态：

```
R2#
*Jun  6 06:40:56.223: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf nei
R2#
```

R2感知不到R1的接口未开启ospf进程，继续发送hello报文，dead time后未收到回包，触发dead time过期提示，然后邻居状态变为down。

### 3，不匹配的timer

在R1的E0/0接口上修改ospf的默认hello间隔：

```
R1(config)#int e0/0
R1(config-if)#ip ospf hello-interval 9
```

邻居状态变为down：

```
R1#
*Jun  6 06:54:05.543: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R1#show ip ospf neighbor 
R1#
```

R2的邻居状态也变为down：

```
R2#
*Jun  6 06:54:07.696: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf neighbor 
R2#
```

### 4，不匹配的区域号

修改R1的E0/0接口上的OSPF区域号：

```
R1(config)#router ospf 1
R1(config-router)#no net 192.168.12.1 0.0.0.0 a 0
R1(config-router)#
*Jun  6 07:04:05.246: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
R1(config-router)#net 192.168.12.1 0.0.0.0 a 1
R1(config-router)#
*Jun  6 07:05:00.101: %OSPF-4-ERRRCV: Received invalid packet: mismatched area ID from backbone area from 192.168.12.2, Ethernet0/0
R1(config-router)#
*Jun  6 07:05:09.763: %OSPF-4-ERRRCV: Received invalid packet: mismatched area ID from backbone area from 192.168.12.2, Ethernet0/0
R1(config-router)#
*Jun  6 07:05:19.329: %OSPF-4-ERRRCV: Received invalid packet: mismatched area ID from backbone area from 192.168.12.2, Ethernet0/0
R1(config-router)#
```

邻居状态变为down：

```
R1#show ip ospf neighbor 
R1#
```

R2亦然：

```
R2#
*Jun  6 07:04:40.519: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf neighbor 
R2#
```

### 5，不匹配的区域类型

将R1和R2的所有接口配置为area 1（area 0不能配置为特殊区域），并将R1的area 1配置为stub区域：

```
R1(config)#router ospf 1
R1(config-router)#area 1 stub 
R1(config-router)#
*Jun  6 07:25:49.454: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Adjacency forced to reset
```

邻居状态变为down：

```
R1#show ip ospf neighbor 

Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           1   DOWN/DROTHER       -        192.168.12.2    Ethernet0/0
```

R2的邻居状态也为down：

```
*Jun  6 07:26:20.126: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf neighbor 
R2#
```

### 6，不同的子网掩码

将R1的E0/0接口的子网掩码改为255.255.255.128：

```
R1(config)#int e0/0
R1(config-if)#ip add 192.168.12.1 255.255.255.128
R1(config-if)#
*Jun  6 07:54:35.550: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
R1(config-if)#
R1#show
*Jun  6 07:54:46.168: %SYS-5-CONFIG_I: Configured from console by console
R1#show ip ospf nei
R1#
```

邻居状态变为down。

R2亦然：

```
R2(config-router)#
*Jun  6 07:55:07.455: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf neighbor 
R2#
```

### 7，被动接口

将R1的E0/0改为被动接口：

```
R1(config)#router ospf 1
R1(config-router)#passive-interface e0/0
R1(config-router)#
*Jun  6 08:14:51.990: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
```

邻居状态变为down。

R2亦然：

```
R2#
*Jun  6 08:15:24.117: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf neighbor 
R2#
```

### 8，不匹配的认证信息

在R1的E0/0接口上开启MD5认证（R2的对端口未开启认证）：

```
R1(config)#int e0/0
R1(config-if)#ip ospf message-digest-key 1 md5 KENAN
R1(config-if)#ip ospf authentication message-digest 
R1(config-if)#
*Jun  6 08:49:14.100: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
```

邻居状态变为down：

```
R1#show ip ospf neighbor 
R1#
```

R2亦然：

```
R2#
*Jun  6 08:49:11.234: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf nei
R2#
```

### 9，ACL

##### 1），在R1上部署ACL，过滤掉OSPF协议，并在接口E0/0上应用：

```
R1(config)#access-list 100 deny ospf any any
R1(config)#access-list 100 permit ip any any
R1(config)#int ethernet 0/0
R1(config-if)#ip access-group 100 in
R1(config-if)#ip access-group 100 out
```

重启OSPF进程，邻居变为down：

```
R1#clear ip ospf process 
Reset ALL OSPF processes? [no]: yes
R1#
*Jun  6 09:09:41.155: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
R1#show ip ospf nei
R1#
```

R2的邻居状态变为INIT：

```
R2#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
1.1.1.1           1   INIT/DROTHER    00:00:32    192.168.12.1    Ethernet0/0
```

##### 2），在R1上部署ACL，过滤掉组播地址224.0.0.5，并在接口E0/0上应用：

```
R1(config)#access-list 101 deny igmp any host 224.0.0.5
R1(config)#access-list 101 permit ip any any
R1(config)#int e0/0
R1(config-if)#ip access-group 101 in
R1(config-if)#ip access-group 101 out
```

重启OSPF进程，邻居变为down：

```
R1#clea ip ospf pr
Reset ALL OSPF processes? [no]: yes
R1#
*Jun  6 09:34:19.390: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
R1#show ip ospf nei
R1#
```

R2的邻居变为INIT：

```
R2#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
1.1.1.1           1   INIT/DROTHER    00:00:31    192.168.12.1    Ethernet0/0
```

### 10，MTU不匹配

修改R1上E0/0的MTU：

```
R1(config)#int e0/0
R1(config-if)#ip mtu 1400
```

重启OSPF进程，邻居状态变为EXSTART：

```
R1#clea ip ospf pr
Reset ALL OSPF processes? [no]: yes
R1#
*Jun  6 09:52:30.130: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
R1#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           1   EXSTART/DR      00:00:39    192.168.12.2    Ethernet0/0
R1#
```

R2亦然：

```
R2#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
1.1.1.1           1   EXSTART/BDR     00:00:38    192.168.12.1    Ethernet0/0
R2#
```

### 11，重复的router id

将R1的ospf router id改为和R2的一样：

```
R1(config)#router ospf 1
R1(config-router)#router-id 2.2.2.2
% OSPF: Reload or use "clear ip ospf process" command, for this to take effect
R1(config-router)# 
R1#
*Jun  6 10:01:13.184: %SYS-5-CONFIG_I: Configured from console by console
R1#clear ip ospf pr
Reset ALL OSPF processes? [no]: yes
```

邻居状态变为down：

```
R1#
*Jun  6 10:01:24.058: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
R1#
*Jun  6 10:01:26.524: %OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id 2.2.2.2 from 192.168.12.2 on interface Ethernet0/0
R1#show ip ospf nei
R1#
```

R2亦然：

```
*Jun  6 10:02:04.023: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#clea ip ospf pro
% Please answer 'yes' or 'no'.
Reset ALL OSPF processes? [no]: yes
R2#show ip ospf nei
R2#
```

### 12，不匹配的网络类型

##### 1），将R1的E0/0口的ospf网络类型改为点对点：

```
R1(config)#int e0/0
R1(config-if)#ip ospf network point-to-point
```

邻居状态变为down，又变为full：

```
R1(config-if)#
*Jun  6 10:10:04.048: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
*Jun  6 10:10:04.049: %OSPF-4-NET_TYPE_MISMATCH: Received Hello from 2.2.2.2 on Ethernet0/0 indicating a  potential 
             network type mismatch
R1(config-if)#
*Jun  6 10:10:04.050: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from LOADING to FULL, Loading Done
```

对端路由器的接口ospf网络类型默认为广播，虽然本端被改为了点对点，但它们具有相同的hello time（10s）和dead time（40s），所以能形成正常的邻接关系并交换LSA，但由于两端的链路类型不一致，各自的1类LSA中的link ID表示的含义不一样（P2P类型的LINK ID为对端的router ID，广播类型的LINK ID为DR的IP），所以无法计算最短路径树，也就无法学到ospf路由。

```
R1#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           0   FULL/  -        00:00:30    192.168.12.2    Ethernet0/0
R1#
```

```
R1#show ip rou ospf
Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP
       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area 
       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2
       E1 - OSPF external type 1, E2 - OSPF external type 2
       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2
       ia - IS-IS inter area, * - candidate default, U - per-user static route
       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP
       a - application route
       + - replicated route, % - next hop override

Gateway of last resort is not set

R1#
```

R2的邻居状态也为full：

```
R2#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
1.1.1.1           1   FULL/BDR        00:00:36    192.168.12.1    Ethernet0/0
```



##### 2），将R1的E0/0口的ospf网络类型改为点对多点：

```
R1(config)#int e0/0
R1(config-if)#ip ospf network point-to-multipoint
```

邻居状态变为down，因为和对端网络类型的hello time和dead time不一致，所以不能建立邻接关系。

```
R1(config-if)#
*Jun  6 10:41:54.846: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Interface down or detached
R1(config-if)#
R1#
*Jun  6 10:42:17.683: %SYS-5-CONFIG_I: Configured from console by console
R1#show ip ospf nei
R1#
```

R2亦然：

```
*Jun  6 11:32:03.265: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from FULL to DOWN, Neighbor Down: Dead timer expired
R2#show ip ospf nei
R2#
```

综上可知，不同网络类型之间，只要time一致，都能建立邻接关系（full），但不能学到路由。

### 13，OSPF优先级设置错误

将R1的E0/0和R2的E0/0的OSPF优先级都设置成为0（不允许参与DR和BDR的选举）：

```
R1(config)#int e0/0
R1(config-if)#ip ospf priority 0
```

```
R2(config)#int e0/0
R2(config-if)#ip ospf priority 0
```

双方的邻居状态都变成了2way：

```
R1#clea ip ospf pr
Reset ALL OSPF processes? [no]: yes
R1#
*Jun  6 13:09:59.713: %OSPF-5-ADJCHG: Process 1, Nbr 2.2.2.2 on Ethernet0/0 from 2WAY to DOWN, Neighbor Down: Interface down or detached
R1#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           0   2WAY/DROTHER    00:00:33    192.168.12.2    Ethernet0/0
R1#
```

```
R2#clea ip ospf pr
Reset ALL OSPF processes? [no]: yes
R2#
*Jun  6 13:10:17.577: %OSPF-5-ADJCHG: Process 1, Nbr 1.1.1.1 on Ethernet0/0 from 2WAY to DOWN, Neighbor Down: Interface down or detached
R2#show ip ospf nei

Neighbor ID     Pri   State           Dead Time   Address         Interface
1.1.1.1           0   2WAY/DROTHER    00:00:33    192.168.12.1    Ethernet0/0
R2#
```



### 总结：

<table>
    <tr>
        <td>邻居状态</td>
        <td>可能原因</td>
    </tr>
    <tr>
        <td rowspan="10">down</td>
        <td>接口down</td>
    </tr>
    <tr>
        <td>接口未运行ospf进程</td>
    </tr>
    <tr>
        <td>不匹配的timer</td>
    </tr>
    <tr>
        <td>不匹配的区域号</td>
    </tr>
    <tr>
        <td>不匹配的区域类型</td>
    </tr>
    <tr>
        <td>不同的子网掩码</td>
    </tr>
    <tr>
        <td>被动接口</td>
    </tr>
    <tr>
        <td>不匹配的认证信息</td>
    </tr>
    <tr>
        <td>重复的router id</td>
    </tr>
    <tr>
        <td>不匹配的网络类型</td>
    </tr>
    <tr>
        <td rowspan="1">INIT</td>
        <td>ACL</td>
    </tr>
    <tr>
        <td rowspan="1">2WAY</td>
        <td>接口的OSPF优先级设置错误</td>
    </tr>
    <tr>
        <td rowspan="1">EXSTART/EXCHANGE</td>
        <td>MTU不匹配</td>
    </tr>
</table>

注：如果两个接口的OSPF网络类型的timer值相同（比如点对点和广播），是可以形成邻接关系的（可到达full状态），但不会传递路由。

此验证实验所用模拟器为pnet，镜像为思科IOL，IOS版本为15.4。本文列举的所有可能原因均为常见原因，所呈现的邻居状态在不同模拟器和IOS版本之间可能有出入。
