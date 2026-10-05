fetch("http://192.168.101.65:8088/data/xep-ban-capacity.json?v=1791012845309", {
  "headers": {
    "accept": "*/*",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "cookie": "_ga=GA1.1.690183971.1790396935; _ga_S875RCBNQW=GS2.1.s1790826394$o6$g1$t1790826398$j56$l0$h0",
    "Referer": "http://192.168.101.65:8088/dashboard-nang-luc-xep-ban-ngay.html"
  },
  "body": null,
  "method": "GET"
}).then(response => response.json()).then(data => {
    console.log(JSON.stringify(data))}).catch(err => console.error(err)
);