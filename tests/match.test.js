require("../assets/match.js");
const M = globalThis.JPCMatch; let fail = 0;
const ok = (n, c, extra) => { if(!c){ fail++; console.log("FAIL:", n, extra||""); } else console.log("ok  :", n); };
const P = [
 {id:"1",code:"JPC-001",area:"Jhotwara",propertyType:"Plot",size:"50 gaj",budgetMin:3500000,budgetMax:3500000,details:"corner plot, 30 ft road"},
 {id:"2",code:"JPC-002",area:"Jhotwara Industrial Area",propertyType:"Plot",size:"100 gaj",budgetMin:6500000,budgetMax:6500000,details:"east facing"},
 {id:"3",code:"JPC-003",area:"Vaishali Nagar",propertyType:"Flat",size:"2 BHK",budgetMin:5500000,budgetMax:5500000,details:"near metro"},
 {id:"4",code:"JPC-004",area:"Khatipura",propertyType:"House",size:"1200 sq ft",budgetMin:8000000,budgetMax:8000000,details:"independent house"},
 {id:"5",code:"JPC-005",area:"Jagatpura",propertyType:"Residential Plot",size:"72 gaj",areaGaj:72,budgetMin:4800000,budgetMax:4800000,details:""},
 {id:"6",code:"JPC-006",area:"Chaksu",propertyType:"Land",size:"2 bigha",budgetMin:2000000,budgetMax:2000000,details:"agricultural"},
];
const ids = (q) => M.search(P, q).map(x=>x.p.id).join(",");
ok("parse budget lakh", M.parseBudget("under 40 lakh").max===4000000);
ok("parse budget range", (b=>b.min===3000000&&b.max===4000000)(M.parseBudget("30 to 40 lakh")));
ok("parse crore", M.parseBudget("1.2 cr").bare===12000000);
ok("parse gaj", M.parseSize("50 Gaj plot").gaj===50);
ok("parse sqft->gaj", Math.round(M.parseSize("1200 sqft").gaj)===133);
ok("bhk", M.parseSize("2 BHK").bhk===2);
ok("area alias jhotwada", M.canonArea("plot in Jhotwada")==="jhotwara");
ok("search multiword", ids("50 gaj plot jhotwara under 40 lakh")==="1", ids("50 gaj plot jhotwara under 40 lakh"));
ok("search plot jhotwara", ids("plot jhotwara")==="1,2" || ids("plot jhotwara")==="2,1", ids("plot jhotwara"));
ok("search house under 90 lakh", ids("house under 90 lakh")==="4", ids("house under 90 lakh"));
ok("search 2 bhk flat vaishali", ids("2 bhk flat vaishali nagar")==="3");
ok("search code", ids("JPC-005")==="5");
ok("hinglish zameen", ids("zameen jhotwada")==="1,2"||ids("zameen jhotwada")==="2,1", ids("zameen jhotwada"));
ok("plot excludes land", !ids("plot").includes("6"));
ok("fuzzy word", ids("independant house")==="4", ids("independant house"));
ok("no results gives empty", ids("villa mansarovar")==="");
ok("empty query = all", M.search(P,"").length===6);
// CRM matching
const buyer = {area:"Jhotwara",propertyType:"Plot",budgetMax:4000000,size:"50 gaj"};
const s1 = M.score(buyer,P[0]), s2 = M.score(buyer,P[1]), s3 = M.score(buyer,P[2]), s4=M.score(buyer,P[3]);
console.log(s1,s2,s3,s4);
ok("perfect match high", s1.score>=95);
ok("same area, too big & pricey lower", s2.score<s1.score && s2.score<70);
ok("flat in other area very low", s3.score<35);
ok("nearby house low", s4.score<50);
const near = M.score({area:"Kalwar Road",propertyType:"Plot",budgetMax:4000000}, P[0]);
ok("nearby area gets partial", near.why.includes("Paas ka area") && near.score>=60, JSON.stringify(near));
const onlyArea = M.score({area:"Jhotwara"}, P[0]);
ok("area-only is moderate not perfect", onlyArea.score<70 && onlyArea.score>=50, JSON.stringify(onlyArea));
ok("plot buyer vs land cousin", M.score({propertyType:"Plot",area:"Chaksu"},P[5]).why.includes("Milta-julta type"));
ok("empty customer = 0", M.score({},P[0]).score===0);
ok("details fallback size", M.score({area:"Jagatpura",details:"72 gaj plot chahiye budget 50 lakh",budgetMax:5000000},P[4]).why.includes("Size fits"));
ok("only-min budget ok", M.score({budgetMin:3000000,area:"Jhotwara"},P[0]).why.includes("Budget fits"));
process.exit(fail?1:0);
