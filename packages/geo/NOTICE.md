# 数据来源与许可

本包的定义（对象、页面、翻译）以 Apache-2.0 发布，见 [LICENSE](LICENSE)。随包的数据有两个来源：

## 国家和地区：Unicode CLDR 49

`objects/country/object.yaml` 的名称（英文与中文）取自 [Unicode CLDR](https://cldr.unicode.org) 49.0.0（`cldr-json` 的 `cldr-localenames-full`），
ISO 3166-1 三位字母代码与数字代码取自同一版本的 `cldr-core/supplemental/codeMappings.json`。只收 ISO 3166-1 正式分配的 249 个代码。
台湾、香港、澳门的中英文名称按中国大陆通行写法改为“中国台湾”“中国香港”“中国澳门”与 “Taiwan, China” 等，其余未改。CLDR 数据按下面的许可使用：

```
UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 2015-2024 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.

SPDX-License-Identifier: Unicode-3.0
```

## 中国行政区划：民政部 2023 年县以上行政区划代码

`data/division.yaml` 取自民政部公布的
[2023 年中华人民共和国县以上行政区划代码](https://www.mca.gov.cn/mzsj/xzqh/2023/202301xzqh.html)：34 个省级、333 个地级、2842 个县级。
这是国家机关公布的行政文件，按《著作权法》第五条不受著作权保护。名称后的“*”（省直辖县级行政区划的汇总码标记）已去掉；
上级与全称由代码推出：县级先找同前四位的地级，没有就归省级（直辖市的区县、省直辖县级行政区划）。台湾省、香港、澳门暂无下级。
