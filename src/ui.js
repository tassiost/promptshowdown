// Phase 11: hand-authored visual recipes for the 6 starter units.
// Each recipe: {shapes:[...], animations:{idle,move,attack,death}}.
// Coordinates are relative to unit center (u.x, u.y). Y is down.
const SPRITE_RECIPES={
  Knight:{
    shapes:[
      // Helmet with visor slit
      {t:"circle",cx:0,cy:-18,r:6,c:"#888"},
      {t:"rect",x:-4,y:-19,w:8,h:2,c:"#222"},          // visor slit
      {t:"rect",x:-7,y:-22,w:14,h:3,c:"#aaa"},         // helmet brim/pauldron
      // Armor body with chest plate
      {t:"rect",x:-5,y:-12,w:10,h:14,c:"#44aaff"},
      {t:"rect",x:-4,y:-11,w:8,h:6,c:"#3399ee",outline:1}, // chest plate (darker)
      {t:"line",x1:0,y1:-11,x2:0,y2:-5,c:"#226",w:1},  // chest plate center line
      // Belt
      {t:"rect",x:-5,y:-2,w:10,h:2,c:"#654"},          // belt
      // Shield (left arm)
      {t:"rect",x:-13,y:-10,w:6,h:10,c:"#ccc",joint:"arm_raise"},
      {t:"rect",x:-12,y:-9,w:4,h:4,c:"#4af",joint:"arm_raise"}, // shield emblem
      // Sword (right arm) with crossguard
      {t:"line",x1:9,y1:-8,x2:16,y2:-16,c:"#ccc",w:2,joint:"arm_raise"}, // blade
      {t:"line",x1:7,y1:-7,x2:11,y2:-7,c:"#aa4",w:2,joint:"arm_raise"}, // crossguard
      {t:"circle",cx:8,cy:-7,r:1,c:"#aa4",joint:"arm_raise"}, // pommel
      // Legs with armor
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#338",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#338",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:4,h:3,c:"#226",joint:"leg_swing"}, // boots
      {t:"rect",x:1,y:9,w:4,h:3,c:"#226",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Archer:{
    shapes:[
      // Head with hood
      {t:"circle",cx:0,cy:-18,r:6,c:"#fdc"},
      {t:"polygon",pts:[[-7,-22],[7,-22],[5,-18],[-5,-18]],c:"#4a7"}, // hood
      // Tunic with belt
      {t:"rect",x:-5,y:-12,w:10,h:14,c:"#4a7"},
      {t:"rect",x:-5,y:-2,w:10,h:2,c:"#372"},          // belt
      // Quiver on back
      {t:"rect",x:-10,y:-14,w:3,h:8,c:"#642"},         // quiver
      {t:"line",x1:-9,y1:-15,x2:-9,y2:-13,c:"#ccc",w:1}, // arrow fletching
      {t:"line",x1:-8,y1:-15,x2:-8,y2:-13,c:"#ccc",w:1},
      // Bow with string
      {t:"arc",cx:12,cy:-10,r:8,start:-1,end:1,c:"#a72",w:2,joint:"bow_draw"}, // bow
      {t:"line",x1:8,y1:-17,x2:8,y2:-3,c:"#ddd",w:0.5,joint:"bow_draw"}, // bowstring
      // Arms
      {t:"rect",x:-9,y:-10,w:4,h:10,c:"#4a7",joint:"arm_raise"},
      {t:"rect",x:5,y:-10,w:4,h:10,c:"#4a7",joint:"arm_raise"},
      // Legs
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#372",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#372",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:4,h:3,c:"#241",joint:"leg_swing"}, // boots
      {t:"rect",x:1,y:9,w:4,h:3,c:"#241",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,bow_draw:0,arm_raise:0},{t:0.5,bow_draw:1,arm_raise:0.5},{t:1,bow_draw:0,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Slash:{
    shapes:[
      // Head with headband
      {t:"circle",cx:0,cy:-18,r:6,c:"#fdd"},
      {t:"rect",x:-6,y:-21,w:12,h:2,c:"#f44"},         // headband
      // Body with chest strap
      {t:"rect",x:-5,y:-12,w:10,h:14,c:"#f44"},
      {t:"line",x1:-5,y1:-10,x2:5,y2:2,c:"#a22",w:1.5}, // diagonal strap
      // Belt
      {t:"rect",x:-5,y:-2,w:10,h:2,c:"#621"},
      // Big sword with crossguard + pommel
      {t:"line",x1:9,y1:-8,x2:18,y2:-18,c:"#eee",w:3,joint:"arm_raise"}, // blade
      {t:"line",x1:7,y1:-7,x2:12,y2:-7,c:"#cc4",w:2,joint:"arm_raise"}, // crossguard
      {t:"circle",cx:8,cy:-7,r:1.5,c:"#cc4",joint:"arm_raise"}, // pommel
      // Left arm
      {t:"rect",x:-9,y:-10,w:4,h:10,c:"#f44",joint:"arm_raise"},
      // Legs with boots
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#a33",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#a33",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:4,h:3,c:"#622",joint:"leg_swing"},
      {t:"rect",x:1,y:9,w:4,h:3,c:"#622",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:0.6,arm_raise:0.2},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Priest:{
    shapes:[
      // Head with hood
      {t:"circle",cx:0,cy:-18,r:6,c:"#fdc"},
      {t:"polygon",pts:[[-7,-22],[7,-22],[5,-18],[-5,-18]],c:"#fd4"}, // hood
      // Robe (trapezoid) with holy symbol
      {t:"polygon",pts:[[-7,-12],[7,-12],[5,12],[-5,12]],c:"#fd4"},
      {t:"line",x1:-2,y1:-8,x2:2,y2:-8,c:"#fff",w:1.5}, // holy cross horizontal
      {t:"line",x1:0,y1:-10,x2:0,y2:-4,c:"#fff",w:1.5}, // holy cross vertical
      // Belt/sash
      {t:"rect",x:-6,y:-3,w:12,h:2,c:"#ea0"},
      // Staff with orb
      {t:"line",x1:8,y1:-12,x2:8,y2:-24,c:"#fb0",w:2,joint:"arm_raise"},
      {t:"circle",cx:8,cy:-25,r:3,c:"#fff",glow:6},
      // Left arm
      {t:"rect",x:-9,y:-10,w:4,h:10,c:"#fd4",joint:"arm_raise"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.5,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Assassin:{
    shapes:[
      // Hooded head with hood point
      {t:"circle",cx:0,cy:-18,r:6,c:"#222"},
      {t:"polygon",pts:[[-7,-22],[7,-22],[3,-26],[-3,-24]],c:"#222"}, // hood point
      {t:"line",x1:-3,y1:-19,x2:3,y2:-19,c:"#f44",w:1}, // eye slit (red)
      // Dark body with cloak
      {t:"rect",x:-5,y:-12,w:10,h:14,c:"#a4f"},
      {t:"polygon",pts:[[-8,-8],[8,-8],[6,4],[-6,4]],c:"#82c",alpha:0.7}, // cloak skirt
      // Dual daggers with crossguards
      {t:"line",x1:9,y1:-6,x2:13,y2:-12,c:"#ccc",w:1.5,joint:"arm_raise"},  // right dagger
      {t:"line",x1:8,y1:-7,x2:10,y2:-7,c:"#884",w:1,joint:"arm_raise"},    // right crossguard
      {t:"line",x1:-9,y1:-6,x2:-13,y2:-12,c:"#ccc",w:1.5,joint:"arm_raise"}, // left dagger
      {t:"line",x1:-10,y1:-7,x2:-8,y2:-7,c:"#884",w:1,joint:"arm_raise"},   // left crossguard
      // Legs
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#82c",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#82c",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:4,h:3,c:"#519",joint:"leg_swing"}, // boots
      {t:"rect",x:1,y:9,w:4,h:3,c:"#519",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.2,arm_raise:1},{t:0.4,arm_raise:0},{t:0.6,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Engineer:{
    shapes:[
      // Head with goggles
      {t:"circle",cx:0,cy:-18,r:6,c:"#fdc"},
      {t:"circle",cx:-2,cy:-19,r:2.5,c:"#884",outline:1}, // left goggle lens
      {t:"circle",cx:2,cy:-19,r:2.5,c:"#884",outline:1},  // right goggle lens
      {t:"line",x1:-4,y1:-19,x2:4,y2:-19,c:"#442",w:1},   // goggle strap
      // Body with tool belt
      {t:"rect",x:-5,y:-12,w:10,h:14,c:"#f84"},
      {t:"rect",x:-5,y:-2,w:10,h:2,c:"#642"},             // belt
      {t:"rect",x:-3,y:-2,w:2,h:3,c:"#888"},              // belt pouch
      // Wrench with detail
      {t:"line",x1:9,y1:-8,x2:14,y2:-14,c:"#888",w:2,joint:"arm_raise"}, // wrench shaft
      {t:"rect",x:12,y:-16,w:4,h:4,c:"#888",joint:"arm_raise"}, // wrench head
      // Left arm
      {t:"rect",x:-9,y:-10,w:4,h:10,c:"#f84",joint:"arm_raise"},
      // Legs with boots
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#a64",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#a64",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:4,h:3,c:"#742",joint:"leg_swing"},
      {t:"rect",x:1,y:9,w:4,h:3,c:"#742",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Wizard:{
    shapes:[
      // Pointed hat with brim
      {t:"polygon",pts:[[-4,-24],[4,-24],[7,-18],[-7,-18]],c:"#6633aa"}, // hat cone
      {t:"rect",x:-8,y:-19,w:16,h:2,c:"#5533aa"},        // hat brim
      {t:"circle",cx:0,cy:-23,r:1,c:"#ddf",glow:4},      // hat star
      // Face with beard
      {t:"circle",cx:0,cy:-15,r:5,c:"#fdc"},
      {t:"polygon",pts:[[-3,-13],[3,-13],[2,-8],[-2,-8]],c:"#eee"}, // beard
      // Robe with rune
      {t:"polygon",pts:[[-7,-12],[7,-12],[5,12],[-5,12]],c:"#bb44ff"},
      {t:"circle",cx:0,cy:-6,r:1.5,c:"#ddf",glow:3},     // robe rune
      // Staff with crystal
      {t:"line",x1:8,y1:-12,x2:8,y2:-24,c:"#fb0",w:2,joint:"arm_raise"},
      {t:"polygon",pts:[[6,-26],[10,-26],[8,-30]],c:"#ddf",glow:6}, // crystal (triangle)
      // Left arm
      {t:"rect",x:-9,y:-10,w:4,h:8,c:"#933",joint:"arm_raise"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      attack:[
        {t:0,arm_raise:0,lunge:0},
        {t:0.15,arm_raise:-0.3,lunge:-0.2,ease:"easeOut"},
        {t:0.35,arm_raise:1,lunge:0.4,ease:"easeInOut"},
        {t:0.55,arm_raise:0.8,lunge:0.2,ease:"easeOut"},
        {t:1,arm_raise:0,lunge:0}
      ],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Plague:{
    shapes:[
      // Sickly green head with hood
      {t:"circle",cx:0,cy:-18,r:6,c:"#4a4"},
      {t:"polygon",pts:[[-7,-22],[7,-22],[5,-18],[-5,-18]],c:"#484"}, // hood
      {t:"line",x1:-2,y1:-19,x2:2,y2:-19,c:"#0f0",w:1}, // glowing eyes
      // Tattered robe
      {t:"polygon",pts:[[-7,-12],[7,-12],[5,12],[-5,12]],c:"#88ff44"},
      {t:"line",x1:-4,y1:0,x2:-3,y2:12,c:"#4a4",w:1},   // tatter lines
      {t:"line",x1:3,y1:-2,x2:4,y2:12,c:"#4a4",w:1},
      // Poisoned dart
      {t:"line",x1:8,y1:-10,x2:14,y2:-16,c:"#6a6",w:2,joint:"arm_raise"},
      {t:"polygon",pts:[[13,-16],[15,-16],[14,-18]],c:"#0f0",glow:3,joint:"arm_raise"}, // poison tip
      // Left arm
      {t:"rect",x:-9,y:-10,w:4,h:10,c:"#5c5",joint:"arm_raise"},
      // Legs
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#484",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#484",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Cultist:{
    shapes:[
      // Hooded head with glowing eyes
      {t:"circle",cx:0,cy:-18,r:6,c:"#222"},
      {t:"polygon",pts:[[-8,-22],[8,-22],[4,-26],[-4,-24]],c:"#222"}, // hood point
      {t:"line",x1:-3,y1:-19,x2:-1,y2:-19,c:"#c4f",w:1.5}, // left eye (glow)
      {t:"line",x1:1,y1:-19,x2:3,y2:-19,c:"#c4f",w:1.5},  // right eye (glow)
      // Dark robe with sigil
      {t:"polygon",pts:[[-8,-12],[8,-12],[6,12],[-6,12]],c:"#aa44ff"},
      {t:"circle",cx:0,cy:-6,r:2,c:"#c4f",glow:4},       // chest sigil
      // Ritual staff with glowing orb
      {t:"line",x1:8,y1:-12,x2:8,y2:-22,c:"#a4f",w:2,joint:"arm_raise"},
      {t:"circle",cx:8,cy:-24,r:3,c:"#c8f",glow:5},
      // Left arm
      {t:"rect",x:-9,y:-10,w:4,h:10,c:"#82a",joint:"arm_raise"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.5,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Berserker:{
    shapes:[
      // Angry red head with war paint
      {t:"circle",cx:0,cy:-18,r:7,c:"#f44"},
      {t:"line",x1:-4,y1:-20,x2:-1,y2:-18,c:"#fff",w:1.5}, // war paint stripe
      {t:"line",x1:1,y1:-20,x2:4,y2:-18,c:"#fff",w:1.5},
      // Muscular body with fur shoulders
      {t:"rect",x:-7,y:-12,w:14,h:14,c:"#ff6644"},
      {t:"polygon",pts:[[-9,-12],[-5,-14],[-5,-10]],c:"#955"}, // left fur shoulder
      {t:"polygon",pts:[[9,-12],[5,-14],[5,-10]],c:"#955"},   // right fur shoulder
      // Belt
      {t:"rect",x:-7,y:-2,w:14,h:2,c:"#421"},
      // Big axe with blade
      {t:"line",x1:10,y1:-8,x2:18,y2:-20,c:"#888",w:3,joint:"arm_raise"}, // shaft
      {t:"polygon",pts:[[16,-18],[20,-16],[18,-22],[14,-20]],c:"#ccc",joint:"arm_raise"}, // axe blade
      // Left arm
      {t:"rect",x:-11,y:-10,w:4,h:10,c:"#f44",joint:"arm_raise"},
      // Legs with boots
      {t:"rect",x:-5,y:2,w:5,h:10,c:"#a33",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:5,h:10,c:"#a33",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:5,h:3,c:"#622",joint:"leg_swing"},
      {t:"rect",x:1,y:9,w:5,h:3,c:"#622",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1.5},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1.5,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.2,arm_raise:-0.5},{t:0.5,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Vamp:{
    shapes:[
      // Pale face with red eyes
      {t:"circle",cx:0,cy:-18,r:6,c:"#fcc"},
      {t:"circle",cx:-2,cy:-19,r:1,c:"#f00"},           // left red eye
      {t:"circle",cx:2,cy:-19,r:1,c:"#f00"},            // right red eye
      // Cape/robe with collar
      {t:"polygon",pts:[[-9,-12],[9,-12],[6,12],[-6,12]],c:"#cc44aa"},
      {t:"polygon",pts:[[-8,-14],[-4,-10],[-6,-8]],c:"#a33"}, // left collar
      {t:"polygon",pts:[[8,-14],[4,-10],[6,-8]],c:"#a33"},   // right collar
      // Fang strike (claw)
      {t:"line",x1:10,y1:-6,x2:14,y2:-14,c:"#f44",w:2,joint:"arm_raise"},
      {t:"polygon",pts:[[13,-14],[15,-14],[14,-16]],c:"#fff",joint:"arm_raise"}, // fang tip
      // Left arm
      {t:"rect",x:-10,y:-10,w:4,h:10,c:"#a3a",joint:"arm_raise"},
      // Legs
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#728",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#728",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:4,h:3,c:"#516",joint:"leg_swing"},
      {t:"rect",x:1,y:9,w:4,h:3,c:"#516",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Bomber:{
    shapes:[
      // Round bomb body with shine
      {t:"circle",cx:0,cy:-10,r:10,c:"#ff8844"},
      {t:"circle",cx:-3,cy:-13,r:3,c:"#ffb"},           // shine highlight
      // Fuse with spark
      {t:"line",x1:0,y1:-20,x2:0,y2:-26,c:"#f80",w:2},
      {t:"circle",cx:0,cy:-27,r:2,c:"#ff0",glow:4},
      // Legs
      {t:"rect",x:-4,y:0,w:3,h:8,c:"#c64",joint:"leg_swing"},
      {t:"rect",x:1,y:0,w:3,h:8,c:"#c64",joint:"leg_swing"},
      {t:"rect",x:-4,y:6,w:3,h:3,c:"#a42",joint:"leg_swing"}, // boots
      {t:"rect",x:1,y:6,w:3,h:3,c:"#a42",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,bob:0},{t:0.5,bob:2},{t:1,bob:0}],
      death:[{t:0,alpha:1,rot:0,scale:1},{t:0.5,alpha:0.5,scale:1.5},{t:1,alpha:0,scale:2}],
    }
  },
  Shielder:{
    shapes:[
      // Head with helmet visor
      {t:"circle",cx:0,cy:-18,r:6,c:"#cdf"},
      {t:"rect",x:-5,y:-19,w:10,h:2,c:"#4af"},          // visor
      // Armored body with chest plate
      {t:"rect",x:-6,y:-12,w:12,h:14,c:"#44aaff"},
      {t:"rect",x:-5,y:-11,w:10,h:8,c:"#3399ee",outline:1}, // chest plate
      // Belt
      {t:"rect",x:-6,y:-1,w:12,h:2,c:"#448"},
      // Big shield with emblem (left)
      {t:"rect",x:-16,y:-14,w:8,h:18,c:"#ccc",joint:"arm_raise"},
      {t:"polygon",pts:[[-14,-10],[-10,-10],[-12,-6]],c:"#4af",joint:"arm_raise"}, // shield emblem (triangle)
      // Short sword (right)
      {t:"line",x1:8,y1:-8,x2:12,y2:-16,c:"#ccc",w:2,joint:"arm_raise"},
      {t:"line",x1:6,y1:-7,x2:10,y2:-7,c:"#aa4",w:1.5,joint:"arm_raise"}, // crossguard
      // Legs with armor
      {t:"rect",x:-5,y:2,w:4,h:10,c:"#338",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:"#338",joint:"leg_swing"},
      {t:"rect",x:-5,y:9,w:4,h:3,c:"#226",joint:"leg_swing"}, // boots
      {t:"rect",x:1,y:9,w:4,h:3,c:"#226",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.5},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:0.5,bob:0.5},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:0.3},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Healer:{
    shapes:[
      // Head with hood
      {t:"circle",cx:0,cy:-18,r:6,c:"#fdc"},
      {t:"polygon",pts:[[-7,-22],[7,-22],[5,-18],[-5,-18]],c:"#ffdd44"}, // hood
      // Robe with cross symbol
      {t:"polygon",pts:[[-7,-12],[7,-12],[5,12],[-5,12]],c:"#ffdd44"},
      {t:"line",x1:-3,y1:-7,x2:3,y2:-7,c:"#fff",w:1.5},  // cross horizontal
      {t:"line",x1:0,y1:-10,x2:0,y2:-3,c:"#fff",w:1.5},  // cross vertical
      // Belt
      {t:"rect",x:-6,y:-3,w:12,h:2,c:"#ea0"},
      // Staff with cross glow
      {t:"line",x1:8,y1:-12,x2:8,y2:-22,c:"#fb0",w:2,joint:"arm_raise"},
      {t:"rect",x:6,y:-18,w:4,h:4,c:"#fff",glow:5},   // cross glow on staff
      {t:"line",x1:6,y1:-17,x2:10,y2:-17,c:"#fff",w:1,joint:"arm_raise"}, // cross horizontal
      // Left arm
      {t:"rect",x:-9,y:-10,w:4,h:10,c:"#fc4",joint:"arm_raise"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.5,arm_raise:1},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
  Tank:{
    shapes:[
      // Helmet with visor slit
      {t:"circle",cx:0,cy:-18,r:7,c:"#aaa"},
      {t:"rect",x:-5,y:-19,w:10,h:2,c:"#222"},          // visor slit
      {t:"rect",x:-8,y:-22,w:16,h:3,c:"#bbb"},          // helmet brim
      // Wide armored body with chest plate
      {t:"rect",x:-9,y:-12,w:18,h:16,c:"#888"},
      {t:"rect",x:-7,y:-11,w:14,h:10,c:"#777",outline:1}, // chest plate
      {t:"line",x1:0,y1:-11,x2:0,y2:-1,c:"#555",w:1},   // chest center line
      // Belt
      {t:"rect",x:-9,y:0,w:18,h:2,c:"#433"},
      // Arm guards (pauldrons)
      {t:"polygon",pts:[[-14,-12],[-10,-14],[-10,-8]],c:"#999",joint:"arm_raise"}, // left pauldron
      {t:"rect",x:-14,y:-10,w:6,h:12,c:"#666",joint:"arm_raise"}, // left arm guard
      {t:"polygon",pts:[[14,-12],[10,-14],[10,-8]],c:"#999",joint:"arm_raise"}, // right pauldron
      {t:"rect",x:8,y:-10,w:6,h:12,c:"#666",joint:"arm_raise"},  // right arm guard
      // Legs with heavy armor
      {t:"rect",x:-6,y:2,w:5,h:10,c:"#555",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:5,h:10,c:"#555",joint:"leg_swing"},
      {t:"rect",x:-6,y:9,w:5,h:4,c:"#333",joint:"leg_swing"}, // heavy boots
      {t:"rect",x:1,y:9,w:5,h:4,c:"#333",joint:"leg_swing"},
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.3},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:0.5,bob:0.3},{t:1,leg_swing:0,bob:0}],
      attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:0.5},{t:1,arm_raise:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}],
    }
  },
};

const G={
  save:loadData(),
  // Phase 15: arena ladder. Each arena: name, color, lives, unlock threshold.
  // botPool = unit names the bot drafts from (themed per arena).
  arenas:[
    {n:"Training Yard",c:"#4a4",lives:3,unlock:0,maxHp:100,maxDmg:30,
     bgTheme:"forest",mechanic:"none",
     botPool:["Knight","Archer","Slash","Priest","Assassin","Engineer","Wizard","Samurai","Frost Archer","Ice Wolf"]},
    {n:"District Z",c:"#8a4",lives:3,unlock:3,maxHp:130,maxDmg:35,
     bgTheme:"plague",mechanic:"poison_aura",
     botPool:["Plague","Cultist","Berserker","Plague Doctor","Scorpion","Shadow Ninja","Crystal Golem"]},
    {n:"Golden Goal",c:"#fa4",lives:3,unlock:8,maxHp:160,maxDmg:45,
     bgTheme:"desert",mechanic:"speed_boost",
     botPool:["Knight","Archer","Slash","Priest","Assassin","Engineer","Vamp","Bomber","Sniper","Phoenix","Harpy","Minotaur"]},
    {n:"Void Rift",c:"#a4f",lives:4,unlock:15,maxHp:200,maxDmg:50,
     bgTheme:"void",mechanic:"damage_aura",
     botPool:["Knight","Archer","Slash","Priest","Assassin","Engineer","Vamp","Bomber","Berserker","Shielder","Healer","Tank","Void Mage","Goblin Bomber","Clockwork","Mushroom Shaman"]},
  ],
  // Phase 10/11: starter roster with Behaviour Composition API fields + recipes.
  // 6 hand-authored units; each sets the 5 behaviour fields directly + visual recipe.
  base:[
    {n:"Knight",h:110,d:12,r:40,s:50,a:1,c:"#44aaff",ability:"none",rar:"common",cost:1,crit:0.05,
     targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:80,role:"frontline",weaponType:"shield",
     recipe:SPRITE_RECIPES.Knight},
    {n:"Archer",h:55,d:15,r:170,s:65,a:1.2,c:"#44ff44",ability:"none",rar:"common",cost:2,crit:0.15,
     targeting:"closest",movement:"kite",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:100,role:"carry",weaponType:"bow",
     recipe:SPRITE_RECIPES.Archer},
    {n:"Slash",h:70,d:20,r:35,s:85,a:1,c:"#ff4444",ability:"splash",rar:"rare",cost:3,crit:0.10,
     targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:100,role:"counter",weaponType:"sword",
     recipe:SPRITE_RECIPES.Slash},
    {n:"Priest",h:65,d:10,r:100,s:50,a:1.5,c:"#ffdd44",ability:"heal",rar:"rare",cost:3,crit:0.05,
     targeting:"lowest_ally",movement:"flee",attackCondition:"never",abilityTrigger:"when_ally_hurt",moveSpeedMod:100,role:"support",weaponType:"staff",
     recipe:SPRITE_RECIPES.Priest},
    {n:"Assassin",h:45,d:20,r:30,s:110,a:0.8,c:"#ff44ff",ability:"dodge",rar:"rare",cost:3,crit:0.30,
     targeting:"lowest_hp",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:150,role:"counter",weaponType:"dagger",
     recipe:SPRITE_RECIPES.Assassin},
    {n:"Engineer",h:60,d:8,r:90,s:45,a:1.3,c:"#ff8844",ability:"spawn",rar:"rare",cost:3,crit:0.05,
     targeting:"closest",movement:"flee",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:80,role:"utility",weaponType:"hammer",
     recipe:SPRITE_RECIPES.Engineer},
    // Phase 20: ramp carry — fragile scaling backline DPS.
    {n:"Wizard",h:50,d:14,r:160,s:55,a:1.3,c:"#bb44ff",ability:"ramp",rar:"legendary",cost:4,crit:0.10,
     targeting:"closest",movement:"kite",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:90,role:"carry",weaponType:"staff",
     recipe:SPRITE_RECIPES.Wizard},
    // Phase 15: arena-themed units (used by bots in higher arenas).
    {n:"Plague",h:60,d:12,r:90,s:55,a:1.3,c:"#88ff44",ability:"poison",rar:"rare",cost:3,crit:0.1,
     targeting:"closest",movement:"kite",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:100,role:"carry",weaponType:"dagger",
     recipe:SPRITE_RECIPES.Plague},
    {n:"Cultist",h:50,d:14,r:80,s:60,a:1.2,c:"#aa44ff",ability:"poison",rar:"rare",cost:2,crit:0.1,
     targeting:"lowest_hp",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:120,role:"counter",weaponType:"staff",
     recipe:SPRITE_RECIPES.Cultist},
    {n:"Berserker",h:75,d:18,r:35,s:90,a:0.9,c:"#ff6644",ability:"rage",rar:"rare",cost:3,crit:0.15,
     targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:130,role:"frontline",weaponType:"axe",
     recipe:SPRITE_RECIPES.Berserker},
    {n:"Vamp",h:65,d:14,r:40,s:70,a:1.1,c:"#cc44aa",ability:"lifesteal",rar:"rare",cost:3,crit:0.1,
     targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:100,role:"frontline",weaponType:"claws",
     recipe:SPRITE_RECIPES.Vamp},
    {n:"Bomber",h:55,d:20,r:30,s:80,a:1.5,c:"#ff8844",ability:"explode",rar:"rare",cost:3,crit:0.05,
     targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_death",moveSpeedMod:140,role:"counter",weaponType:"none",
     recipe:SPRITE_RECIPES.Bomber},
    {n:"Shielder",h:100,d:10,r:45,s:40,a:1.2,c:"#44aaff",ability:"shield",rar:"rare",cost:3,crit:0.05,
     targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:80,role:"frontline",weaponType:"shield",
     recipe:SPRITE_RECIPES.Shielder},
    {n:"Healer",h:70,d:8,r:110,s:45,a:1.5,c:"#ffdd44",ability:"heal_burst",rar:"rare",cost:3,crit:0.05,
     targeting:"lowest_ally",movement:"flee",attackCondition:"never",abilityTrigger:"when_ally_hurt",moveSpeedMod:90,role:"support",weaponType:"staff",
     recipe:SPRITE_RECIPES.Healer},
    {n:"Tank",h:150,d:13,r:35,s:35,a:1.3,c:"#888888",ability:"none",rar:"rare",cost:3,crit:0.05,
     targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:70,role:"frontline",weaponType:"shield",
     recipe:SPRITE_RECIPES.Tank}
  ],
  // Phase 10: G.enemy removed. Bot opponents draft from G.base.
  selected:[],
  snapTimer:null,
  pendingHostArmy:null,

  init(){
    // Phase 7: migrate older saves forward, then fill any missing defaults.
    // J4: If localStorage was empty (quota exceeded), try IndexedDB fallback.
    if(!this.save.version){
      // Bug #126: Safety timeout — if IDB hangs, force-init with defaults
      // so the user isn't stuck on the splash screen forever.
      if(this._initTimer)clearTimeout(this._initTimer);
      this._initTimer=setTimeout(()=>{
        if(!this._initialized){
          console.warn("Init timeout — forcing default save");
          this.save=migrateSave(this.save);
          this._initRest();
        }
      },5000);
      loadDataAsync(data=>{
        if(this._initTimer){clearTimeout(this._initTimer);this._initTimer=null;}
        if(data&&data.version){
          this.save=migrateSave(data);
          this._initRest();
        }else{
          this.save=migrateSave(this.save);
          this._initRest();
        }
      });
      return;
    }
    this.save=migrateSave(this.save);
    this._initRest();
  },
  _initialized:false,
  _initRest(){
    this._initialized=true;
    // Phase 30: init audio on first user gesture (mobile autoplay policy).
    const audioInit=()=>{GameAudio.init();GameAudio.resume();this.applyAudioSettings();document.removeEventListener("pointerdown",audioInit);document.removeEventListener("keydown",audioInit);};
    document.addEventListener("pointerdown",audioInit);
    document.addEventListener("keydown",audioInit);
    if(!this.save.version)this.save.version=CURRENT_VERSION;
    if(!this.save.wins)this.save.wins=0;
    if(!this.save.deck)this.save.deck=this.base.map(unit);
    if(!this.save.ai)this.save.ai=[];
    // Phase 6: progression fields.
    if(!this.save.xp)this.save.xp=0;
    if(!this.save.coins)this.save.coins=0;
    if(!this.save.achievements)this.save.achievements={};
    if(!this.save.upgrades)this.save.upgrades={}; // name -> level
    // Phase 8: match/loadout/collection fields (defined in migrateSave v6).
    if(!this.save.matchWins)this.save.matchWins=0;
    if(!this.save.arena)this.save.arena=0;
    this.save.arena=Math.min(Math.max(0,this.save.arena|0),this.arenas.length-1);
    if(!this.save.ranked)this.save.ranked={name:"",rating:1000,wins:0,losses:0,season:0,peakRating:1000};
    if(!this.save.loadout||!this.save.loadout.length)this.save.loadout=["Knight","Archer","Slash","Wizard"];
    if(!this.save.collection)this.save.collection=[];
    if(this.save._lastMatchWon===undefined)this.save._lastMatchWon=false;
    // Ensure all fields added by migration exist even for current-version saves missing them.
    if(!this.save.settings)this.save.settings={audioEnabled:true,reducedMotion:false,quality:"auto"};
    if(!this.save.spellbook)this.save.spellbook=[];
    if(!this.save.quests||typeof this.save.quests!=="object")this.save.quests={date:"",list:[],streak:{count:0,lastLogin:""}};
    if(!Array.isArray(this.save.quests.list))this.save.quests.list=[];
    if(!this.save.quests.streak||typeof this.save.quests.streak!=="object")this.save.quests.streak={count:0,lastLogin:""};
    if(!this.save.replays)this.save.replays=[];
    if(!this.save.presets)this.save.presets={};
    if(!this.save.spells)this.save.spells=[];
    if(!this.save.unitStats)this.save.unitStats={};
    if(this.save.analyticsOptOut===undefined)this.save.analyticsOptOut=false;
    if(!this.save.forgeDate)this.save.forgeDate="";
    if(this.save.forgeCount===undefined)this.save.forgeCount=0;
    if(!this.save.roleWins)this.save.roleWins={};
    if(this.save.onboarded===undefined)this.save.onboarded=false;
    saveData(this.save);
    this.wins();
    // Phase 31: show onboarding for first-time players.
    if(!this.save.onboarded){this.showOnboarding();}
    else{this.menu();}
    // Phase 33: daily quests + login streaks.
    Quests.checkStreak();
    Quests.generateDaily();
    // Phase 35: analytics.
    Analytics.init();
    Analytics.track("game_start",{arena:this.save.arena||0,wins:this.save.matchWins||0});
    // Phase 37: check for shared unit in URL.
    this.importUnitFromURL();
    // Draft pick timer — countdown and auto-pick on timeout.
    // Only runs the interval when a draft timer is active (no perpetual polling).
    this._draftTimerInterval=null;
    this._startDraftTimerInterval=()=>{
      if(this._draftTimerInterval)return; // already running
      this._draftTimerInterval=setInterval(()=>{
        if(this._draftTimer===undefined||this._draftTimer<=0){
          // No active timer — stop the interval to avoid wasted cycles.
          clearInterval(this._draftTimerInterval);
          this._draftTimerInterval=null;
          return;
        }
        this._draftTimer-=0.1;
        const fill=$("draftTimerFill");
        if(fill){
          const pct=Math.max(0,this._draftTimer/this._draftTimerMax*100);
          fill.style.width=pct+"%";
          fill.style.background=pct<30?"var(--warn)":"var(--accent)";
        }
        if(this._draftTimer<=0){
          this._draftTimer=undefined;
          clearInterval(this._draftTimerInterval);
          this._draftTimerInterval=null;
          const bar=$("draftTimerBar");
          if(bar)bar.style.display="none";
          // Auto-pick first card if player hasn't picked (check _draftPicking to
          // avoid race condition with a simultaneous manual pick).
          if(this.currentOffering&&this.currentOffering.length>0&&!this._draftPicking){
            this.pickDraft(this.currentOffering[0]);
          }
        }
      },100);
    };
    // J4: hide splash now that init (including async IDB fallback) is complete.
    if(typeof hideSplash==="function")hideSplash();
  },

  // Phase 6: player level derived from XP (100 xp per level).
  playerLevel(){return 1+Math.max(0,F((this.save.xp||0)/100));},
  // Phase 6: per-unit upgrade level (0 if none).
  unitLevel(name){return(this.save.upgrades&&this.save.upgrades[name])||0;},
  // Phase 6: apply upgrade bonuses to a cloned unit (+10% hp/d per level).
  // Capped at level 10 (200% bonus) to prevent runaway stats.
  applyUpgrades(u){
    const lvl=Math.max(0,Math.min(this.unitLevel(u.n),10));
    return this._applyUpgradeLevel(u,lvl);
  },
  _applyUpgradeLevel(u,lvl){
    lvl=Math.max(0,Math.min(lvl,10));
    if(lvl>0){
      u.h=F(u.h*(1+0.1*lvl));
      u.d=F(u.d*(1+0.1*lvl));
      u.lvl=lvl;
    }
    return u;
  },

  screen(id){
    document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
    let target=$(id);
    if(!target)target=$("menu");
    if(target)target.classList.add("active");
    // D5: reuse the single battle canvas (#cv) for both draft and battle screens.
    // Reparent it into whichever screen is active so it shows in the right place.
    const cv=$("cv");
    if(cv){
      if(id==="draft"){
        const slot=$("draftCanvasSlot");
        if(slot&&cv.parentElement!==slot)slot.appendChild(cv);
      }else if(id==="battle"){
        const battle=$("battle");
        // Insert before the spell bar (which follows #cv in #battle).
        if(battle&&cv.parentElement!==battle){
          const spellBar=$("spellBar");
          if(spellBar)battle.insertBefore(cv,spellBar);
          else battle.appendChild(cv);
        }
      }
    }
    // Stop the draft battlefield animation loop when leaving the draft screen.
    if(id!=="draft")this._stopDraftAnim();
    // Clean up matchmaking interval when leaving matchmaking screen.
    if(id!=="matchmaking"&&this.matchmakingWaitInterval){
      clearInterval(this.matchmakingWaitInterval);
      this.matchmakingWaitInterval=null;
    }
    // Hide spell bar when not in battle.
    if(id!=="battle"){
      const bar=$("spellBar");
      if(bar)bar.style.display="none";
    }
    // Clean up any leftover fixed overlays (forge confirm, disconnect prompt).
    [...document.querySelectorAll("div")].forEach(d=>{
      if(d.id==="errorPanel")return; // keep error panel
      if(d.style.position==="fixed"&&d.style.zIndex==="9999")d.remove();
    });
  },
  wins(){
    setText("wins",this.save.matchWins||0);
    setText("aiUnits",(this.save.ai||[]).length);
    setText("totalUnits",this.deckUnits().length);
    // Phase 6: progression HUD.
    setText("playerLevel",this.playerLevel());
    setText("coins",this.save.coins||0);
    setText("upgradeCoins",this.save.coins||0);
  },
  // Phase 13: deckUnits returns the loadout (4 cards) resolved to unit objects.
  // This is the draft pool per match.
  loadoutUnits(){
    const loadout=this.save.loadout||["Knight","Frost Archer","Slash","Wizard","Samurai","Phoenix"];
    const coll=this.save.collection||[];
    return loadout.map(name=>{
      // Find in collection first, then base roster.
      const c=coll.find(u=>u.n===name);
      if(c)return c;
      const base=this.base.find(u=>u.n===name);
      if(base)return base;
      // Fallback: first base unit (shouldn't happen with valid loadout).
      return this.base[0];
    });
  },
  // Phase 13: collectionUnits returns all owned units (starters + forged).
  collectionUnits(){
    // Starters are always in the collection.
    const starters=this.base.map(u=>u);
    // Add forged units from save.collection (excluding starters to avoid dupes).
    const starterNames=new Set(starters.map(u=>u.n));
    const forged=(this.save.collection||[]).filter(u=>!starterNames.has(u.n));
    return [...starters,...forged];
  },
  // Phase 13: kept for backward compat (achievements HUD).
  deckUnits(){return this.loadoutUnits();},
  // Phase 31: First-time onboarding — 6-step interactive tutorial.
  onboardStep:0,
  showOnboarding(){
    this.onboardStep=0;
    this._onboardNext();
  },
  _onboardNext(){
    const steps=[
      {text:"Welcome! Your 4-card loadout is your army. Tap DECK to see it.",target:"deck",screen:"menu"},
      {text:"Tap FIGHT to start a match. You'll draft 3 units per round.",target:"matchmaking",screen:"menu"},
      {text:"Pick 1 card from each draw. Reroll if you don't like them.",target:"draft",screen:"draft"},
      {text:"Scout! Tap to reveal what your opponent picked.",target:"scout",screen:"scout"},
      {text:"FIGHT! Units auto-battle. Watch and adapt for round 2.",target:"battle",screen:"battle"},
      {text:"Win 3 rounds to take the match. Good luck!",target:"result",screen:"result"},
    ];
    if(this.onboardStep>=steps.length){
      this.save.onboarded=true;
      saveData(this.save);
      this._closeCoachmark();
      this.menu();
      return;
    }
    const step=steps[this.onboardStep];
    if(step.screen)this.screen(step.screen);
    this._showCoachmark(step.text,step.target,()=>{
      this.onboardStep++;
      this._onboardNext();
    });
  },
  _showCoachmark(text,targetId,onNext){
    this._closeCoachmark();
    const overlay=document.createElement("div");
    overlay.id="coachmark";
    overlay.style.cssText="position:fixed;inset:0;z-index:9999;pointer-events:auto;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:40px;";
    const tooltip=document.createElement("div");
    tooltip.style.cssText="background:var(--card);border:1px solid var(--accent);border-radius:12px;padding:16px 20px;max-width:300px;text-align:center;color:var(--text);font-size:.9rem;box-shadow:0 4px 20px rgba(0,0,0,0.5);";
    tooltip.innerHTML=`<div style="margin-bottom:12px;">${text}</div>`+
      `<div style="display:flex;gap:8px;justify-content:center;">`+
      `<button class="btn" onclick="G._onboardSkip()" style="font-size:.78rem;padding:6px 12px;">Skip</button>`+
      `<button class="btn primary" onclick="G._onboardAdvance()" style="font-size:.78rem;padding:6px 12px;">Next →</button>`+
      `</div>`;
    overlay.appendChild(tooltip);
    document.body.appendChild(overlay);
    this._onboardOnNext=onNext;
    // Highlight target if found.
    const target=document.getElementById(targetId)||document.querySelector(`[onclick*="${targetId}"]`);
    if(target){
      target.style.outline="3px solid var(--accent)";
      target.style.outlineOffset="2px";
      this._onboardTarget=target;
    }
  },
  _onboardAdvance(){
    this._closeCoachmark();
    if(this._onboardOnNext)this._onboardOnNext();
  },
  _onboardSkip(){
    this.save.onboarded=true;
    saveData(this.save);
    this._closeCoachmark();
    this.menu();
  },
  _closeCoachmark(){
    const cm=document.getElementById("coachmark");
    if(cm)cm.remove();
    if(this._onboardTarget){
      this._onboardTarget.style.outline="";
      this._onboardTarget.style.outlineOffset="";
      this._onboardTarget=null;
    }
  },

  // Phase 36: Ranked play — Elo + leaderboard (local).
  rankedTier(rating){
    if(rating>=3000)return{name:"Legend",color:"#f4f"};
    if(rating>=2500)return{name:"Diamond",color:"#4ff"};
    if(rating>=2000)return{name:"Platinum",color:"#4fa"};
    if(rating>=1500)return{name:"Gold",color:"#fd4"};
    if(rating>=1000)return{name:"Silver",color:"#ccc"};
    return{name:"Bronze",color:"#c84"};
  },
  computeElo(rating,opponentRating,win,isBot){
    const k=isBot?25:32;
    const expected=1/(1+Math.pow(10,(opponentRating-rating)/400));
    const score=win===true?1:win===null?0.5:0; // null = draw
    const delta=Math.round(k*(score-expected));
    return Math.max(500,rating+delta);
  },
  showLeaderboard(){
    const r=this.save.ranked;
    if(!r){toast("Ranked data not available");return;}
    const tier=this.rankedTier(r.rating);
    const overlay=document.createElement("div");
    overlay.id="leaderboardModal";
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;";
    const modal=document.createElement("div");
    modal.style.cssText="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:320px;width:90%;";
    modal.innerHTML=
      `<h3 style="margin:0 0 12px;">🏆 Ranked Play</h3>`+
      `<div style="text-align:center;margin-bottom:16px;">`+
      `<div style="font-size:1.5rem;color:${tier.color};font-weight:bold;">${tier.name}</div>`+
      `<div style="font-size:1.2rem;">${r.rating} rating</div>`+
      `<div style="font-size:.8rem;color:var(--muted);">${r.wins}W · ${r.losses}L · Peak: ${r.peakRating}</div>`+
      `</div>`+
      `<div style="font-size:.8rem;color:var(--muted);margin-bottom:12px;">Leaderboard requires a server endpoint (coming soon). Local rating is tracked.</div>`+
      `<button class="btn" onclick="document.getElementById('leaderboardModal').remove()" style="width:100%;">Close</button>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  },

  // Phase 37: share forged unit via URL.
  shareUnit(u){
    try{
      const data=JSON.stringify({n:u.n,h:u.h,d:u.d,r:u.r,s:u.s,a:u.a,z:u.z,crit:u.crit,ability:u.ability,rar:u.rar,cost:u.cost,targeting:u.targeting,movement:u.movement,attackCondition:u.attackCondition,abilityTrigger:u.abilityTrigger,moveSpeedMod:u.moveSpeedMod,role:u.role,weaponType:u.weaponType,bodyPlan:u.bodyPlan,c:u.c,primaryColor:u.c,headFeature:u.headFeature,backFeature:u.backFeature,tailFeature:u.tailFeature,aura:u.aura,eyeStyle:u.eyeStyle,pattern:u.pattern,weaponStyle:u.weaponStyle,recipe:u.recipe});
      const compressed=LZString?LZString.compressToEncodedURIComponent(data):encodeURIComponent(data);
      const url=location.origin+location.pathname+"?unit="+compressed;
      if(navigator.share){
        navigator.share({title:"Prompt Showdown: "+u.n,url}).catch(()=>this._copyShare(url));
      }else{
        this._copyShare(url);
      }
    }catch(e){toast(t("share_failed"));}
  },
  _copyShare(url){
    if(navigator.clipboard){
      navigator.clipboard.writeText(url).then(()=>toast(t("share_copied"))).catch(()=>toast(url));
    }else{toast(url);}
  },
  // Phase 37: save replay on match end.
  saveReplay(winner){
    try{
      const playerTeam=connected&&role==="guest"?"enemy":"player";
      const finalUnits=Battle._finalUnits||Battle.units||[];
      const mvp=finalUnits.filter(u=>u.team===playerTeam&&(u.dmgDealt||0)>0)
        .sort((a,b)=>(b.dmgDealt||0)-(a.dmgDealt||0))[0];
      const replay={
        date:new Date().toISOString().slice(0,16).replace("T"," "),
        winner,
        rounds:Match.history.length,
        roundHistory:[...Match.history],
        units:(this.selected||[]).map(u=>u.n),
        enemyUnits:(this.opponentPicks||[]).map(u=>u.n),
        mvp:mvp?{name:mvp.n,dmg:Math.round(mvp.dmgDealt),kills:mvp.kills||0}:null,
        arena:this.save.arena||0,
        endlessLevel:this.save.endlessLevel||0,
        difficulty:this.save.difficulty||"normal",
      };
      if(!this.save.replays)this.save.replays=[];
      this.save.replays.unshift(replay);
      if(this.save.replays.length>10)this.save.replays=this.save.replays.slice(0,10);
      saveData(this.save);
    }catch(e){console.warn("saveReplay failed:",e);}
  },
  // Share match result as text via clipboard or Web Share API.
  shareMatchResult(){
    const replays=this.save.replays||[];
    const r=replays[0];
    if(!r){toast("No match to share");return;}
    const win=r.winner==="player";
    const draw=r.winner==="draw";
    const arenaName=this.arenas[r.arena]?.n||"Unknown";
    const roundIcons=(r.roundHistory||[]).map(h=>h.winner==="player"?"✅":h.winner==="enemy"?"❌":"➖").join("");
    const units=(r.units||[]).join(", ");
    const mvpText=r.mvp?` | MVP: ${r.mvp.name} (${r.mvp.dmg} dmg)`:"";
    const endlessText=r.endlessLevel>0?` Endless Lv${r.endlessLevel}`:"";
    const text=`🎮 Prompt Showdown\n${draw?"🤝 DRAW":win?"🏆 VICTORY":"💀 DEFEAT"}${endlessText}\n⚔️ ${arenaName} | ${roundIcons}${mvpText}\n📋 Army: ${units}\nPlay: https://tassiost.github.io/promptshowdown/`;
    if(navigator.share){
      navigator.share({title:"Prompt Showdown Result",text}).catch(()=>{});
    }else if(navigator.clipboard){
      navigator.clipboard.writeText(text).then(()=>{
        toast("📋 Result copied to clipboard!");
        GameAudio.sfx("ui_click");
      }).catch(()=>toast("Share failed"));
    }else{
      toast("Sharing not supported on this device");
    }
  },
  // Phase 37: import shared unit from URL.
  importUnitFromURL(){
    const params=new URLSearchParams(location.search);
    const unitParam=params.get("unit");
    if(!unitParam)return;
    try{
      // Try LZString decompress first; fall back to decodeURIComponent for non-compressed URLs.
      let data=LZString?LZString.decompressFromEncodedURIComponent(unitParam):null;
      if(!data)data=decodeURIComponent(unitParam);
      const u=JSON.parse(data);
      if(!u){toast(t("invalid_link"));return;}
      // Sanitize name before rendering to prevent XSS.
      const sanitizedName=String(u._isSpell?u.name:u.n||"Unit").replace(/</g,"").replace(/>/g,"").replace(/"/g,"'");
      if(u._isSpell)u.name=sanitizedName;else u.n=sanitizedName;
      // Security: sanitize effect/trigger for HTML display, and primaryColor.
      const safeEffect=escapeHtml((u.effect||"").replace(/_/g," "));
      const safeTrigger=escapeHtml((u.trigger||"").replace(/_/g," "));
      const safeColor=sanitizeHex(u.primaryColor||"#4a7");
      const safeRole=escapeHtml(u.role||"");
      const safeAbility=escapeHtml(u.ability||"none");
      // Show preview.
      this.screen("forge");
      const preview=$("forgePreview");
      if(preview){
        if(u._isSpell){
          preview.innerHTML=`<div class="card" style="border-color:#fa4;max-width:280px;margin:0 auto;"><div class="title" style="color:#fa4">✨ ${sanitizedName}</div><div class="detail">${safeEffect}<br><span style="color:var(--accent2)">${safeTrigger}</span></div></div><button class="btn primary" onclick="G._importSharedUnit()">➕ Add to Spellbook</button>`;
        }else{
          preview.innerHTML=`<div class="card" style="border-color:var(--accent);max-width:280px;margin:0 auto;"><div class="title" style="color:${safeColor}">${sanitizedName}</div><div class="detail">${Number(u.h)||0} HP · ${Number(u.d)||0} DMG · ${Number(u.r)||0} range<br>${safeRole} · ${safeAbility}</div></div><button class="btn primary" onclick="G._importSharedUnit()">➕ Add to Collection</button>`;
        }
      }
      this._pendingImport=u;
    }catch(e){toast(t("invalid_link"));}
  },
  _importSharedUnit(){
    if(!this._pendingImport)return;
    if(this._pendingImport._isSpell){
      if(!this.save.spellbook)this.save.spellbook=[];
      // Security: sanitize spell name + enum values.
      const spell=sanitizeSpell(this._pendingImport);
      if(!spell)return;
      this.save.spellbook.push(spell);
      if(this.save.spellbook.length>20)this.save.spellbook=this.save.spellbook.slice(-20);
      saveData(this.save);
      toast(t("spell_added_share"));
    }else{
      const sanitized=unit(this._pendingImport);
      this.addForge(sanitized);
      saveData(this.save);
      toast(t("unit_added_share"));
    }
    this._pendingImport=null;
    this.menu();
  },

  // Phase 34: reconnect grace period overlay.
  showReconnect(secondsLeft,onTimeout){
    const overlay=document.createElement("div");
    overlay.id="reconnectOverlay";
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;";
    overlay.innerHTML=`<div style="font-size:1.3rem;margin-bottom:10px;">🔄 Reconnecting...</div><div id="reconnectTimer" style="font-size:2rem;">${secondsLeft}s</div><div style="margin-top:10px;font-size:.8rem;color:#888;">Opponent disconnected. Waiting for reconnect.</div>`;
    document.body.appendChild(overlay);
    let remaining=secondsLeft;
    const interval=setInterval(()=>{
      remaining--;
      const t=overlay.querySelector("#reconnectTimer");
      if(t)t.innerText=remaining+"s";
      if(remaining<=0){
        clearInterval(interval);
        overlay.remove();
        if(onTimeout)onTimeout();
      }
    },1000);
    this._reconnectInterval=interval;
  },
  cancelReconnect(){
    if(this._reconnectInterval)clearInterval(this._reconnectInterval);
    const ov=document.getElementById("reconnectOverlay");
    if(ov)ov.remove();
  },
  // Phase 34: voluntary forfeit from battle.
  forfeitMatch(){
    showConfirm("Forfeit this match? It counts as a loss.",()=>Match.forfeit());
  },

  // Phase 33: Quests UI.
  showQuests(){
    const q=this.save.quests;
    if(!q||!q.list)return;
    const overlay=document.createElement("div");
    overlay.id="questsModal";
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;";
    const modal=document.createElement("div");
    modal.style.cssText="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:320px;width:90%;max-height:80vh;overflow-y:auto;";
    let html=`<h3 style="margin:0 0 8px;">📋 Daily Quests</h3>`;
    html+=`<div style="font-size:.8rem;color:var(--muted);margin-bottom:12px;">🔥 ${q.streak.count}-day streak</div>`;
    for(const quest of q.list){
      const pct=quest.target>0?Math.round((quest.progress/quest.target)*100):0;
      const done=quest.progress>=quest.target;
      const claimed=quest.claimed;
      html+=`<div style="margin:8px 0;padding:10px;background:var(--bg);border-radius:8px;${claimed?"opacity:0.5;":""}">`;
      html+=`<div style="font-size:.85rem;margin-bottom:4px;">${quest.desc}</div>`;
      html+=`<div style="background:var(--card);border-radius:4px;height:6px;overflow:hidden;margin:4px 0;"><div style="background:var(--accent);height:6px;width:${pct}%;"></div></div>`;
      html+=`<div style="display:flex;justify-content:space-between;align-items:center;font-size:.75rem;">`;
      html+=`<span>${quest.progress}/${quest.target} · 💰${quest.reward.coins}</span>`;
      if(claimed)html+=`<span style="color:var(--ok);">✅ Done</span>`;
      else if(done)html+=`<button class="btn primary" onclick="Quests.claim('${quest.id}');G._refreshQuests();" style="font-size:.72rem;padding:3px 8px;">Claim</button>`;
      else html+=`<span style="color:var(--muted);">In progress</span>`;
      html+=`</div></div>`;
    }
    html+=`<button class="btn" onclick="document.getElementById('questsModal').remove()" style="margin-top:10px;width:100%;">Close</button>`;
    modal.innerHTML=html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  },
  _refreshQuests(){
    const m=document.getElementById("questsModal");
    if(m)m.remove();
    this.showQuests();
    this.wins();
  },
  _updateQuestBadge(){
    const q=this.save.quests;
    if(!q||!q.list)return;
    const hasClaimable=q.list.some(x=>!x.claimed&&x.progress>=x.target);
    const badge=$("questBadge");
    if(badge)badge.style.display=hasClaimable?"inline":"none";
  },

  // Phase 32: Settings & accessibility.
  showKeyboardHelp(){
    // Remove existing overlay.
    const existing=document.getElementById("kbHelpOverlay");
    if(existing){existing.remove();return;}
    const overlay=document.createElement("div");
    overlay.id="kbHelpOverlay";
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;";
    overlay.onclick=()=>overlay.remove();
    const modal=document.createElement("div");
    modal.style.cssText="background:var(--card);border:1px solid var(--accent);border-radius:var(--radius);padding:20px;max-width:320px;width:90%;box-shadow:var(--shadow-lg);";
    modal.onclick=e=>e.stopPropagation();
    const shortcuts=[
      {key:"1 / 2 / 3",desc:"Pick draft card 1, 2, or 3"},
      {key:"R",desc:"Reroll draft cards"},
      {key:"Space",desc:"Advance battle one tick"},
      {key:"P",desc:"Pause / resume battle"},
      {key:"1 / 2 / 3",desc:"Set battle speed to 1× / 2× / 4×"},
      {key:"S",desc:"Skip battle to end"},
      {key:"A",desc:"Toggle auto-battle"},
      {key:"D",desc:"Toggle debug logging"},
      {key:"Esc",desc:"Close modal / go to menu"},
      {key:"?",desc:"Show this help overlay"},
    ];
    let html="<div style='font-weight:700;font-size:1rem;margin-bottom:12px;text-align:center;'>⌨️ Keyboard Shortcuts</div>";
    html+="<div style='display:flex;flex-direction:column;gap:6px;'>";
    for(const s of shortcuts){
      html+=`<div style="display:flex;align-items:center;gap:10px;font-size:.78rem;">`+
        `<span style="min-width:70px;text-align:center;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px 8px;font-weight:700;font-family:monospace;">${s.key}</span>`+
        `<span style="color:var(--muted);">${s.desc}</span></div>`;
    }
    html+="</div>";
    html+="<div style='text-align:center;margin-top:12px;font-size:.65rem;color:var(--muted);'>Tap anywhere to close</div>";
    modal.innerHTML=html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  },
  showSettings(){
    this.screen("settings");
    const s=this.save.settings||{};
    const set=(id,val)=>{const el=$(id);if(el&&val!==undefined){if(el.type==="checkbox")el.checked=val;else el.value=val;}};
    set("setAudioEnabled",s.audioEnabled!==false);
    set("setSfxVol",Math.round((s.sfxVol??0.7)*100));
    set("setMusicVol",Math.round((s.musicVol??0.4)*100));
    set("setQuality",s.quality||"auto");
    set("setReducedMotion",s.reducedMotion||false);
    set("setColorblind",s.colorblind||"off");
    set("setHighContrast",s.highContrast||false);
    set("setAnalyticsOptOut",this.save.analyticsOptOut||false);
    set("setLang",this.save.settings?.lang||"en");
  },
  saveSetting(key,val){
    if(!this.save.settings)this.save.settings={};
    if(key==="analyticsOptOut"){this.save.analyticsOptOut=val;saveData(this.save);toast(t("settings_saved"));return;}
    this.save.settings[key]=val;
    saveDataDebounced(this.save);
    toast(t("settings_saved"));
    // Apply immediately.
    if(key==="audioEnabled"||key==="sfxVol"||key==="musicVol")this.applyAudioSettings();
    // E4: Clear colorblind cache when setting changes.
    if(key==="colorblind")this._colorblindCache={};
    // Language: update HTML lang attribute and re-render current screen.
    if(key==="lang"){
      document.documentElement.lang=val;
      // Re-render the current screen so translations take effect.
      const active=document.querySelector(".screen.active");
      if(active&&active.id){
        const screenMap={menu:"menu",deck:"deck",shop:"shop",upgrade:"upgrade",forge:"forge",codex:"codex",stats:"stats",settings:"settings",achievements:"achievements",replays:"replays",tierlist:"tierList",profile:"profile"};
        const fn=screenMap[active.id];
        if(fn&&typeof this[fn]==="function")this[fn]();
      }
    }
  },
  applyAudioSettings(){
    const s=this.save.settings||{};
    GameAudio.enabled=s.audioEnabled!==false;
    GameAudio.sfxVol=s.sfxVol??0.7;
    GameAudio.musicVol=s.musicVol??0.4;
    GameAudio.applyVolumes();
  },
  // Phase 32: colorblind color remap.
  // E4: Cache filtered colors to avoid per-shape per-frame object creation.
  _colorblindCache:{},
  applyColorblind(hex){
    const cb=this.save.settings?.colorblind||"off";
    if(cb==="off"||!hex||!hex.startsWith("#"))return hex;
    // E4: Check cache first.
    const key=cb+":"+hex;
    if(this._colorblindCache[key]!==undefined)return this._colorblindCache[key];
    let h=hex.slice(1);
    if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n=parseInt(h,16);
    let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    if(cb==="deuteranopia"){// red→orange, green→yellow
      r=Math.min(255,r+30);g=Math.min(255,g+30);
    }else if(cb==="protanopia"){// red→darker, green→brighter
      r=Math.max(0,r-30);g=Math.min(255,g+20);
    }else if(cb==="tritanopia"){// blue→cyan, yellow→red
      b=Math.min(255,b+20);r=Math.min(255,r+10);
    }
    const result="#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");
    this._colorblindCache[key]=result;
    return result;
  },
  // Phase 32: quality tier.
  qualityTier(){
    const q=this.save.settings?.quality||"auto";
    if(q==="auto")return this._fpsTier||"high";
    return q;
  },

  menu(){
    this.screen("menu");
    this.wins();
    this._updateQuestBadge(); // Phase 33
    // I1: Start ambient menu music.
    GameAudio.init();GameAudio.stopMusic();GameAudio.startAmbient();
    // Phase 15/19a: arena badge + unlock progress + theme color.
    const arenaIdx=this.save.arena||0;
    const arena=this.arenas[arenaIdx];
    const nextArena=this.arenas[arenaIdx+1];
    const badge=$("arenaBadge");
    if(badge&&arena){
      let html=`<span style="color:${arena.c}">⚔️ ${arena.n}</span> · ${arena.lives} lives`;
      if(nextArena){
        const winsNeeded=nextArena.unlock-(this.save.matchWins||0);
        if(winsNeeded>0){
          html+=`<br><span style="color:#888;font-size:.8rem">Next: ${nextArena.n} — ${winsNeeded} more wins to unlock</span>`;
        }else{
          html+=`<br><span style="color:#0f0;font-size:.8rem">✓ ${nextArena.n} unlocked! Play to advance</span>`;
        }
      }else{
        const el=this.save.endlessLevel||0;
        if(el>0){
          html+=`<br><span style="color:#f0f;font-size:.8rem">♾️ Endless Level ${el} — enemy stats +${el*15}% HP, +${el*10}% DMG</span>`;
        }else{
          html+=`<br><span style="color:#fa0;font-size:.8rem">★ Final arena — win to start Endless Mode</span>`;
        }
      }
      // Show arena mechanic description.
      const mechDescs={poison_aura:"☠️ Poison Aura: all units take 2 dmg/s",speed_boost:"🏃 Speed Boost: all units +20% speed",damage_aura:"💥 Damage Aura: all units take 3 dmg/s"};
      if(arena.mechanic&&arena.mechanic!=="none"&&mechDescs[arena.mechanic]){
        html+=`<br><span style="color:${arena.c};font-size:.7rem;font-style:italic;">${mechDescs[arena.mechanic]}</span>`;
      }
      badge.innerHTML=html;
      // Phase 19a: theme color shift on the h1.
      const h1=document.querySelector("#menu h1");
      if(h1){h1.style.background="none";h1.style.webkitTextFillColor=arena.c;h1.style.color=arena.c;}
    }
    // Win streak indicator on menu.
    const streakEl=$("streakBadge");
    if(streakEl){
      const s=this.save.winStreak||0;
      if(s>=2){
        const flames="🔥".repeat(Math.min(s,10));
        streakEl.style.display="block";
        streakEl.innerHTML=`${flames} ${s}-WIN STREAK (best: ${this.save.bestStreak||0})`;
      }else{
        streakEl.style.display="none";
      }
    }
    // Difficulty selector highlight.
    this.updateDifficultyUI();
    // Daily challenge indicator.
    const dailyEl=$("dailyBadge");
    if(dailyEl){
      const today=new Date().toDateString();
      if((this.save.lastDailyWin||"")!==today){
        dailyEl.style.display="block";
        dailyEl.style.color="#fbbf24";
        dailyEl.innerHTML="🎁 Daily Challenge: Win a match for +100💰 bonus!";
      }else{
        dailyEl.style.display="block";
        dailyEl.style.color="var(--ok)";
        dailyEl.innerHTML="✅ Daily Challenge complete — come back tomorrow!";
      }
    }
    // Tip of the day (changes each day).
    const tipEl=$("tipOfDay");
    if(tipEl){
      const tips=[
        "💡 Frontline units absorb damage — always bring one!",
        "💡 Carries deal high damage but need protection.",
        "💡 Support units heal — they keep your army alive.",
        "💡 Counter units dive enemy backlines to disrupt carries.",
        "💡 Reroll draft cards if you don't like the options.",
        "💡 Win 3 rounds to take the match. Adapt between rounds!",
        "💡 Fuse duplicate units to level them up.",
        "💡 Upgrade units with coins to boost their stats.",
        "💡 Check the Codex to learn about abilities and roles.",
        "💡 Win streaks give bonus coins — don't break the streak!",
        "💡 Spells can turn the tide — tap the spell bar to cast.",
        "💡 Hard mode gives tougher enemies but the same rewards.",
        "💡 Endless mode starts after clearing all arenas.",
        "💡 Press P to pause, 1/2/3 for speed, S to skip in battle.",
        "💡 A balanced loadout has frontline + carry + support.",
        "💡 Lifesteal units heal themselves — great for carries.",
        "💡 Taunt forces enemies to attack your tank instead of carries.",
        "💡 Executioner deals 3× damage to low-HP enemies.",
        "💡 Ramp units get stronger with each kill.",
        "💡 Chain lightning hits 3 enemies — great vs clusters.",
      ];
      const dayIdx=new Date().getDate();
      tipEl.innerHTML=tips[dayIdx%tips.length];
    }
    // Unit spotlight: rotates daily, shows a featured unit from collection.
    const spotEl=$("unitSpotlight");
    if(spotEl){
      const coll=this.collectionUnits();
      if(coll.length>0){
        const dayIdx=new Date().getDate();
        const featured=coll[dayIdx%coll.length];
        const mastery=this.save.unitMastery?.[featured.n];
        const masteryText=mastery&&mastery.kills>0?` · ${mastery.kills} kills`:"";
        const abIcons={none:"",splash:"💥",heal:"💚",dodge:"💨",poison:"☠️",spawn:"✨",lifesteal:"🩸",explode:"💣",heal_burst:"💖",shield:"🛡️",rage:"😤",slow:"🐌",ramp:"📈",thorns:"🌵",blink_strike:"⚡",frenzy:"🔥",regen:"🌿",cleanse:"🧹",taunt:"📣",executioner:"🗡️",chain_lightning:"🌩️"};
        const abIcon=abIcons[featured.ability]||"";
        const abText=featured.ability&&featured.ability!=="none"?`${abIcon} ${featured.ability}`:"No ability";
        spotEl.style.display="block";
        spotEl.innerHTML=`<span style="color:var(--accent);font-weight:700;">⭐ Unit Spotlight:</span> `+
          `<span style="color:${featured.c};font-weight:700;">${featured.n}</span> `+
          `<span style="color:var(--muted);">(${featured.role||"unknown"}) · ${featured.h} HP · ${featured.d} DMG · ${abText}${masteryText}</span>`;
      }else{
        spotEl.style.display="none";
      }
    }
    // Phase 12: forge button. Normally gated behind Training Yard completion
    // (arena >= 1 or 3+ wins), but shown from the start while testing the LLM.
    const forgeBtn=$("forgeMenuBtn");
    if(forgeBtn){
      const TESTING_FORGE=true; // TODO: set false before ship — gate behind Training Yard.
      const showForge=TESTING_FORGE||(this.save.arena||0)>=1||(this.save.matchWins||0)>=3;
      forgeBtn.style.display=showForge?"inline-block":"none";
    }
    // Phase 12: update AI status badge.
    const aiStatus=$("aiStatus");
    if(aiStatus){
      aiStatus.innerText=llmReady?"AI: Ready":llmLoading?"AI: Loading...":"AI: "+(navigator.gpu?"Idle":"Unavailable (templates)");
    }
  },
  lobby(){this.screen("lobby");},
  // Phase 18: matchmaking flow — join a shared queue room, wait for opponent.
  // Both players join the same queue room. First to join waits (becomes host
  // via tiebreaker), second to join triggers the match. No bot fallback —
  // player must explicitly click "Play vs Bot Now" to skip the queue.
  matchmakingTimer:null,
  matchmakingWaitStart:0,
  matchmakingWaitInterval:null,
  startMatchmaking(){
    this.screen("matchmaking");
    setText("matchmakingStatus","Entering queue...");
    setText("matchmakingQueueInfo","");
    // Try to join the arena queue room via trystero.
    // All players in the same arena share one queue room.
    const arenaIdx=this.save.arena||0;
    const queueRoom=`psd-arena-${arenaIdx}-queue`;
    // Suppress P2P errors during matchmaking (silent queue join).
    suppressP2PErrors=true;
    let netOk=false;
    try{
      netOk=this.host(queueRoom,true);
    }catch(e){
      suppressP2PErrors=false;
      setText("matchmakingStatus","P2P unavailable — starting bot match...");
      this.startBotMatch();
      return;
    }
    suppressP2PErrors=false;
    // If trystero not loaded or room creation failed, fall back immediately.
    if(!netOk){
      setText("matchmakingStatus","P2P unavailable — starting bot match...");
      this.startBotMatch();
      return;
    }
    // Start wait timer + UI updates.
    this.matchmakingCancelled=false;
    this.matchmakingWaitStart=Date.now();
    setText("matchmakingStatus","In queue — waiting for opponent...");
    setText("matchmakingQueueInfo","Room: "+queueRoom);
    // Update wait timer every second.
    if(this.matchmakingWaitInterval)clearInterval(this.matchmakingWaitInterval);
    this.matchmakingWaitInterval=setInterval(()=>{
      if(this.matchmakingCancelled)return;
      const elapsed=Math.floor((Date.now()-this.matchmakingWaitStart)/1000);
      const mins=Math.floor(elapsed/60);
      const secs=elapsed%60;
      const timeStr=mins>0?`${mins}m ${secs}s`:`${secs}s`;
      setText("matchmakingStatus",`In queue — waiting for opponent... (${timeStr})`);
      // Animate the timer bar (pulsing effect, never depletes since we wait indefinitely).
      const fill=$("matchmakingTimerFill");
      if(fill){
        const pulse=0.5+0.5*Math.sin(elapsed*2);
        fill.style.width=(40+pulse*60)+"%";
      }
      // P2P: connection timeout — after 60s, offer bot match.
      if(elapsed>=60){
        clearInterval(this.matchmakingWaitInterval);
        this.matchmakingWaitInterval=null;
        setText("matchmakingStatus","No opponent found. Starting bot match...");
        if(connected&&typeof disconnect==="function"){try{disconnect();}catch(e){}}
        setTimeout(()=>this.startBotMatch(),1000);
      }
    },1000);
  },
  // Skip the queue and play vs bot immediately.
  skipQueue(){
    setText("matchmakingStatus","Starting bot match...");
    this.startBotMatch();
  },
  cancelMatchmaking(){
    this.matchmakingCancelled=true;
    if(this.matchmakingTimer){clearTimeout(this.matchmakingTimer);this.matchmakingTimer=null;}
    if(this.matchmakingWaitInterval){clearInterval(this.matchmakingWaitInterval);this.matchmakingWaitInterval=null;}
    // Disconnect from the queue room.
    if(connected&&typeof disconnect==="function"){try{disconnect();}catch(e){}}
    this.menu();
  },
  // Phase 18: start a bot match (fake multiplayer — no network).
  startBotMatch(){
    this.matchmakingCancelled=true;
    if(this.matchmakingTimer){clearTimeout(this.matchmakingTimer);this.matchmakingTimer=null;}
    if(this.matchmakingWaitInterval){clearInterval(this.matchmakingWaitInterval);this.matchmakingWaitInterval=null;}
    // Disconnect from any queue room.
    if(connected&&typeof disconnect==="function"){try{disconnect();}catch(e){}}
    this.start();
  },
  // Phase 8/9/15/18: G.start starts a Match (bot or P2P).
  // For bot matches, this is called directly. For P2P, the host/guest
  // flow calls this after the connection is established.
  start(){
    // Phase 15: generate bot loadout from the current arena's bot pool.
    const arena=this.arenas[this.save.arena||0];
    Bot.generateLoadout(arena?arena.botPool:this.base.map(u=>u.n));
    // Bot difficulty scaling: easy = -20% stats, normal = 0, hard = +20%.
    const diff=this.save.difficulty||"normal";
    const diffMod=diff==="easy"?0.8:diff==="hard"?1.2:1.0;
    if(diffMod!==1.0){
      for(const u of Bot.loadout){
        u.h=Math.round(u.h*diffMod);
        u.d=Math.round(u.d*diffMod);
        u.mh=u.h;
      }
    }
    // Endless mode: scale bot unit stats based on endless level (stacks with difficulty).
    const endlessLvl=this.save.endlessLevel||0;
    if(endlessLvl>0){
      for(const u of Bot.loadout){
        u.h=Math.round(u.h*(1+endlessLvl*0.15));
        u.d=Math.round(u.d*(1+endlessLvl*0.10));
        u.mh=u.h;
      }
    }
    // Phase 15: arena determines lives count. Endless mode gets +1 life per 5 levels.
    const lives=arena?arena.lives:DEFAULT_LIVES;
    const botLives=endlessLvl>0?lives+Math.floor(endlessLvl/5):lives;
    // Phase 18: send match_start to guest.
    if(connected&&role==="host"){
      transmit("match_start",{arena:this.save.arena||0,lives,firstPlayer:"host"});
      connState="IN_MATCH";
    }
    Match.start(lives,winner=>this.onMatchEnd(winner));
    // Override enemy lives for endless mode (after Match.start sets defaults).
    if(endlessLvl>0)Match.livesEnemy=botLives;
    // Easy mode: bot gets -1 life. Hard mode: bot gets +1 life.
    if(diff==="easy"&&Match.livesEnemy>1)Match.livesEnemy--;
    if(diff==="hard")Match.livesEnemy++;
  },

  // Set bot difficulty level.
  setDifficulty(level){
    this.save.difficulty=level;
    saveDataDebounced(this.save);
    this.updateDifficultyUI();
  },
  updateDifficultyUI(){
    const diff=this.save.difficulty||"normal";
    for(const d of ["easy","normal","hard"]){
      const btn=$("diff"+d.charAt(0).toUpperCase()+d.slice(1));
      if(btn)btn.className="btn"+(d===diff?" primary":"");
    }
  },

  // Quick match: skip draft, random army, straight to battle.
  quickMatch(){
    const arena=this.arenas[this.save.arena||0];
    Bot.generateLoadout(arena?arena.botPool:this.base.map(u=>u.n));
    // Apply difficulty + endless scaling.
    const diff=this.save.difficulty||"normal";
    const diffMod=diff==="easy"?0.8:diff==="hard"?1.2:1.0;
    const endlessLvl=this.save.endlessLevel||0;
    for(const u of Bot.loadout){
      u.h=Math.round(u.h*diffMod*(1+endlessLvl*0.15));
      u.d=Math.round(u.d*diffMod*(1+endlessLvl*0.10));
      u.mh=u.h;
    }
    const lives=arena?arena.lives:DEFAULT_LIVES;
    let botLives=endlessLvl>0?lives+Math.floor(endlessLvl/5):lives;
    if(diff==="easy"&&botLives>1)botLives--;
    if(diff==="hard")botLives++;
    // Generate random player army from loadout.
    const pool=[...this.loadoutUnits()];
    const randomPicks=[];
    const used=new Set();
    for(let i=0;i<3;i++){
      let attempts=10;
      while(attempts-->0){
        const u=pool[F(R()*pool.length)];
        if(u&&!used.has(u.n)){used.add(u.n);randomPicks.push(cloneUnit(u));break;}
      }
    }
    // 30% chance to add a spell.
    const spellbook=this.save.spellbook||[];
    if(spellbook.length&&R()<0.3){
      randomPicks.push({...spellbook[F(R()*spellbook.length)],_isSpell:true});
    }
    this.selected=randomPicks;
    Match.start(lives,winner=>this.onMatchEnd(winner));
    if(endlessLvl>0||diff!=="normal")Match.livesEnemy=botLives;
    // Continuous draft: go through normal draft flow (no more quick-skip).
    this.opponentPicks=Bot.draftRound(3);
  },

  // Continuous draft: render the battlefield canvas showing placed units.
  // Shows player units (survivors + current picks) and enemy units (bot survivors + revealed picks).
  _draftPlayerUnits:[],   // units placed on battlefield during this draft
  _draftEnemyUnits:[],   // enemy units revealed so far
  _draftBotPicks:[],     // all bot picks for this round (revealed one per player pick)
  _draftBotRevealed:0,   // how many bot picks have been revealed
  playerSurvivors:[],    // units that survived from previous round
  enemySurvivors:[],     // enemy units that survived from previous round

  // Size the (shared) battle canvas for draft mode. Fills the mobile portrait container.
  _sizeDraftCanvas(){
    const cv=$("cv");
    if(!cv)return;
    const dpr=window.devicePixelRatio||1;
    // Use the active screen container dimensions (fullscreen on phone and web).
    const screen=document.querySelector(".screen.active")||document.getElementById("draft");
    const dispW=screen?screen.clientWidth:Math.min(420,innerWidth);
    const dispH=screen?screen.clientHeight:innerHeight;
    cv.style.width=dispW+"px";
    cv.style.height=dispH+"px";
    cv.width=Math.round(dispW*dpr);
    cv.height=Math.round(dispH*dpr);
    // Update Battle's cached canvas dimensions so _gameTransform centers correctly.
    Battle.canvasW=dispW;
    Battle.canvasH=dispH;
    // D5: reset Battle's cached ctx so it picks up the new bitmap size.
    Battle.ctx=null;
  },

  renderDraftBattlefield(){
    const cv=$("cv");
    if(!cv)return;
    // PERF: alpha:false for opaque canvas (faster compositing).
    const ctx=cv.getContext("2d",{alpha:false,desynchronized:true});
    const w=cv.width,h=cv.height;
    const dpr=window.devicePixelRatio||1;
    const W=Battle.GAME_W,H=Battle.GAME_H;
    // Clear previous frame to prevent artifacts.
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,w,h);
    // Fill the full canvas with background (in bitmap pixel space).
    const arena=this.arenas?.[this.save?.arena||0];
    const bgTheme=Battle._bgThemes[arena?.bgTheme||"forest"]||Battle._bgThemes.forest;
    // Contain transform: fit game space within canvas, center.
    const sx=w/W, sy=h/H;
    const scale=Math.min(sx,sy);
    const offsetX=(w-W*scale)/2;
    const offsetY=(h-H*scale)/2;
    // Draw background in full canvas space (no game transform).
    const grad=ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,bgTheme.top);
    grad.addColorStop(0.5,bgTheme.mid);
    grad.addColorStop(1,bgTheme.bot);
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,w,h);
    // Arena radial glow (full canvas).
    if(arena){
      const rg=ctx.createRadialGradient(w/2,h*0.45,0,w/2,h*0.45,Math.max(w,h)*0.6);
      const ac=sanitizeHex(arena.c);
      rg.addColorStop(0,ac+"10");
      rg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=rg;
      ctx.fillRect(0,0,w,h);
    }
    // Apply game-space transform for all game content.
    ctx.save();
    ctx.translate(offsetX,offsetY);
    ctx.scale(scale,scale);
    // Ground band.
    const groundY=H*0.72;
    const gg=ctx.createLinearGradient(0,groundY-20,0,groundY+30);
    gg.addColorStop(0,"rgba(0,0,0,0)");
    gg.addColorStop(0.5,bgTheme.ground+"40");
    gg.addColorStop(1,bgTheme.ground+"20");
    ctx.fillStyle=gg;
    ctx.fillRect(0,groundY-20,W,50);
    ctx.strokeStyle=bgTheme.accent+"30";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,groundY);ctx.lineTo(W,groundY);ctx.stroke();
    // Lane formation bands (same as battle).
    const laneBands=[
      {yMin:30,yMax:80,color:"#ff4444"},
      {yMin:80,yMax:200,color:"#ff8844"},
      {yMin:350,yMax:540,color:"#4488ff"},
    ];
    for(const lane of laneBands){
      const ly=(lane.yMin+lane.yMax)/2;
      const lh=lane.yMax-lane.yMin;
      const lg=ctx.createLinearGradient(0,ly-lh/2,0,ly+lh/2);
      lg.addColorStop(0,lane.color+"08");
      lg.addColorStop(0.5,lane.color+"0d");
      lg.addColorStop(1,lane.color+"08");
      ctx.fillStyle=lg;
      ctx.fillRect(0,ly-lh/2,W,lh);
      ctx.strokeStyle=lane.color+"15";ctx.lineWidth=1;
      ctx.setLineDash([6,4]);
      ctx.beginPath();
      ctx.moveTo(0,ly-lh/2);ctx.lineTo(W,ly-lh/2);
      ctx.moveTo(0,ly+lh/2);ctx.lineTo(W,ly+lh/2);
      ctx.stroke();ctx.setLineDash([]);
    }
    // Center divider.
    ctx.strokeStyle="rgba(255,255,255,.06)";ctx.lineWidth=1;
    ctx.setLineDash([8,8]);
    ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
    ctx.setLineDash([]);
    // --- Unit sprites ---
    // Temporarily set Battle.time for idle animation interpolation.
    const savedTime=Battle.time;
    Battle.time=this._draftTime||0;
    const allPlayer=[...this.playerSurvivors,...this._draftPlayerUnits];
    const allEnemy=[...this.enemySurvivors,...this._draftEnemyUnits];
    // Draw enemy first (top), then player (bottom) — paint order matches battle.
    for(const u of allEnemy){ctx.globalAlpha=u._isSurvivor?0.85:1;SpriteRenderer.draw(ctx,u);}
    for(const u of allPlayer){ctx.globalAlpha=u._isSurvivor?0.85:1;SpriteRenderer.draw(ctx,u);}
    ctx.globalAlpha=1;
    Battle.time=savedTime;
    // --- Team labels + counts ---
    ctx.fillStyle=TEAM_COLORS.player;ctx.font="bold 11px sans-serif";ctx.textAlign="left";
    ctx.fillText("▼ You: "+allPlayer.length,4,H-6);
    ctx.fillStyle=TEAM_COLORS.enemy;ctx.textAlign="right";
    ctx.fillText("Enemy: "+allEnemy.length+" ▲",W-4,14);
    ctx.textAlign="left";
    ctx.restore();
  },

  // Idle animation loop for the draft canvas — animates unit bob/breathe.
  _draftAnimId:null,
  _draftTime:0,
  _startDraftAnim(){
    if(this._draftAnimId)return;
    let last=performance.now();
    const tick=(now)=>{
      const dt=Math.min(0.05,(now-last)/1000);last=now;
      this._draftTime+=dt;
      // Only redraw if the draft screen is active.
      if(document.getElementById("draft")?.classList.contains("active")){
        this.renderDraftBattlefield();
        this._draftAnimId=requestAnimationFrame(tick);
      }else{
        this._draftAnimId=null;
      }
    };
    this._draftAnimId=requestAnimationFrame(tick);
  },
  _stopDraftAnim(){
    if(this._draftAnimId){cancelAnimationFrame(this._draftAnimId);this._draftAnimId=null;}
  },

  // Place a unit on the draft battlefield at its formation position.
  _placeDraftUnit(u,isPlayer){
    const [yMin,yMax]=this._formationY(u.role,isPlayer);
    const xSpread=Q(40,160);
    const xPos=isPlayer?xSpread:400-xSpread;
    const placed={...u,x:xPos,y:Q(yMin,yMax),h:u.h,mh:u.mh||u.h,team:isPlayer?"player":"enemy",animState:"idle",attackT:-1};
    return placed;
  },

  // Phase 9: called by Match.startRound() to start the sequential draft.
  startRoundDraft(){
    GameAudio.sfx("round_start"); // Phase 30
    // Rerolls are per-match: only reset on round 1.
    if(Match.round===1){this.rerolls=3;this.playerSurvivors=[];this.enemySurvivors=[];}
    // Determine draw count: 4th-draw comeback if player lost last round.
    // Guest uses host-sent draw count (comeback is from host's perspective).
    const drawCount=(connected&&role==="guest")?(this._hostDrawCount||3):(Match.comebackEligible()?4:3);
    this.roundDraftState={drawIndex:0,picks:[],drawCount};
    this._pendingGuestDeck=null; // clear stale guest deck from previous round
    this.pendingHostArmy=null;   // clear stale host army from previous round
    this.selected=[];
    // Continuous draft: reset placed units, generate bot picks for this round.
    this._draftPlayerUnits=[];
    this._draftEnemyUnits=[];
    this._draftBotRevealed=0;
    if(!Bot.loadout.length)Bot.generateLoadout(this.arenas[this.save.arena||0]?.botPool||this.base.map(u=>u.n));
    const botComeback=Match.history.length>0&&Match.history[Match.history.length-1].winner==="player";
    this._draftBotPicks=Bot.draftRound(drawCount);
    // Mark survivors for visual distinction and re-position them in their
    // assigned formation bands (they keep end-of-battle x/y otherwise).
    this.playerSurvivors=this.playerSurvivors.map(u=>{
      const p=this._placeDraftUnit(u,true);
      return {...p,_isSurvivor:true};
    });
    this.enemySurvivors=this.enemySurvivors.map(u=>{
      const p=this._placeDraftUnit(u,false);
      return {...p,_isSurvivor:true};
    });
    this.screen("draft");
    this.updateLivesHUD();
    this._sizeDraftCanvas();
    this.renderDraftBattlefield();
    this._startDraftAnim();
    this.drawOne();
  },

  // Phase 8: lives hearts HUD for draft and battle screens.
  livesHearts(lives,max){
    const full="❤️".repeat(Math.max(0,lives));
    const empty="🖤".repeat(Math.max(0,max-lives));
    return full+empty;
  },
  updateLivesHUD(){
    const txt=`You ${this.livesHearts(Match.livesPlayer,DEFAULT_LIVES)} | Enemy ${this.livesHearts(Match.livesEnemy,DEFAULT_LIVES)}`;
    const draftHUD=$("livesHUD");
    if(draftHUD)draftHUD.innerHTML=this.livesHearts(Match.livesPlayer,DEFAULT_LIVES);
    const draftEnemyHUD=$("livesHUDEnemy");
    if(draftEnemyHUD)draftEnemyHUD.innerHTML=this.livesHearts(Match.livesEnemy,DEFAULT_LIVES);
    // New battle HUD: player/enemy hearts, names, levels, round.
    const ph=$("hudPlayerHearts");
    if(ph)ph.innerHTML=this.livesHearts(Match.livesPlayer,DEFAULT_LIVES);
    const eh=$("hudEnemyHearts");
    if(eh)eh.innerHTML=this.livesHearts(Match.livesEnemy,DEFAULT_LIVES);
    const hr=$("hudRound");
    if(hr)hr.textContent=Match.round||1;
    const pl=$("hudPlayerLevel");
    if(pl)pl.textContent="Lv"+(this.save.level||1);
    const el=$("hudEnemyLevel");
    if(el)el.textContent="Lv"+((this.arenas[this.save.arena||0]?.botLevel)||Math.max(1,(this.save.level||1)-1));
    const pn=$("hudPlayerName");
    if(pn)pn.textContent=this.save.name||"You";
    const en=$("hudEnemyName");
    if(en)en.textContent=connected?"Opponent":(this.arenas[this.save.arena||0]?.name||"Enemy");
    // Legacy battleHUD compat (if element exists).
    const battleHUD=$("livesBattle");
    if(battleHUD)battleHUD.innerText=txt;
    // Round history bar: visual indicator of round wins/losses.
    const rhb=$("roundHistoryBar");
    if(rhb&&Match.history.length>0){
      let html="";
      for(const h of Match.history){
        const win=h.winner==="player";
        const color=win?"var(--ok)":"var(--warn)";
        const icon=win?"W":"L";
        html+=`<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;border-radius:4px;font-size:.7rem;font-weight:700;">${icon}</div>`;
      }
      rhb.innerHTML=html;
    }
  },

  // Phase 9: show a single draw of 3 cards. Player picks 1 → next draw.
  drawOne(){
    const st=this.roundDraftState;
    if(!st)return;
    // Clear any existing timer before starting a new one
    this._clearDraftTimer();
    // Generate 3 cards for this draw (no dupes within this draw).
    const usedNames=new Set(st.picks.map(u=>u._isSpell?u.name:u.n));
    const offering=[];
    for(let i=0;i<3;i++){
      const u=this.rollOne(usedNames);
      if(u){
        usedNames.add(u._isSpell?u.name:u.n);
        offering.push(u);
      }
    }
    // Fallback: if rollOne returned null, add a base unit to ensure 3 cards.
    while(offering.length<3){
      const fallback=G.base[offering.length%G.base.length];
      if(fallback&&!usedNames.has(fallback.n)){
        offering.push(unit(fallback));
        usedNames.add(fallback.n);
      }else break;
    }
    this.currentOffering=offering;
    this.renderDraw();
    // Start draft pick timer (20 seconds per pick).
    this._draftTimer=20;
    this._draftTimerMax=20;
    const bar=$("draftTimerBar");
    if(bar)bar.style.display="block";
    // Start the countdown interval (self-stopping when timer hits 0).
    if(this._startDraftTimerInterval)this._startDraftTimerInterval();
  },

  // Auto-pick a draft card (called by timer timeout).
  pickDraft(u){
    const st=this.roundDraftState;
    if(!st||!u||this._draftPicking)return;
    if(st.picks.includes(u))return; // Prevent duplicate picks
    this._draftPicking=true;
    this._clearDraftTimer();
    st.picks.push(u);
    st.drawIndex++;
    GameAudio.sfx("draft_pick");
    // Continuous draft: place unit on battlefield canvas immediately.
    if(!u._isSpell){
      const placed=this._placeDraftUnit(u,true);
      this._draftPlayerUnits.push(placed);
    }
    // Reveal one bot pick on the enemy side (simultaneous drafting).
    if(this._draftBotPicks[this._draftBotRevealed]&&!this._draftBotPicks[this._draftBotRevealed]._isSpell){
      const botPick=this._draftBotPicks[this._draftBotRevealed];
      const botPlaced=this._placeDraftUnit(botPick,false);
      this._draftEnemyUnits.push(botPlaced);
    }
    this._draftBotRevealed++;
    this.renderDraftBattlefield();
    if(st.drawIndex>=st.drawCount){
      this.selected=st.picks;
      this.currentOffering=null; // Clear stale offering
      if(connected&&role==="guest"){
        transmit("round_deck",{picks:serializeUnitsForPeer(st.picks)});
        // NETHARDEN: retransmit round_deck if no ack received within 5s.
        // WebRTC is reliable, but connection drops at this critical moment
        // would leave the host waiting forever for the guest's deck.
        let retries=0;
        const retransmit=()=>{
          if(retries>=3){console.warn("[P2P] round_deck: no ack after 3 retries.");return;}
          retries++;
          transmit("round_deck",{picks:serializeUnitsForPeer(st.picks)});
          G._deckRetransmitTimer=setTimeout(retransmit,5000);
        };
        G._deckRetransmitTimer=setTimeout(retransmit,5000);
      }
      // Skip scout — go straight to battle (continuous draft model).
      this.startBattle();
    }else{
      this.drawOne();
    }
    this._draftPicking=false;
  },
  _clearDraftTimer(){
    this._draftTimer=undefined;
    if(this._draftTimerInterval){clearInterval(this._draftTimerInterval);this._draftTimerInterval=null;}
    const bar=$("draftTimerBar");
    if(bar)bar.style.display="none";
  },

  // Phase 9: render the current draw (3 cards + progress dots).
  renderDraw(){
    const st=this.roundDraftState;
    if(!st)return;
    let area=$("draftArea");
    if(!area)return;
    area.innerHTML="";
    // Cards are now direct children of #draftArea (flex container).
    for(const u of this.currentOffering){
      area.appendChild(this.draftCard(u));
    }
    // Progress dots: ● for done, ○ for remaining, ★ for comeback 4th draw.
    let dots="";
    for(let i=0;i<st.drawCount;i++){
      if(i<st.drawIndex)dots+="● ";
      else if(i===3)dots+="★ ";
      else dots+="○ ";
    }
    const dd=$("draftDots");
    if(dd)dd.innerText=dots.trim();
    const dh=$("draftHint");
    if(dh)dh.innerText=`Draw ${st.drawIndex+1} of ${st.drawCount}: Pick 1 unit`;
    // Role balance indicator: show picked roles so far as colored pills.
    const roleEl=$("draftRoles");
    if(roleEl){
      const pickedRoles=st.picks.filter(p=>!p._isSpell).map(p=>p.role);
      if(pickedRoles.length){
        const roleColors={frontline:"#fb7185",carry:"#fbbf24",support:"#34d399",counter:"#a78bfa",utility:"#60a5fa",assassin:"#f472b6",bruiser:"#fb923c"};
        roleEl.innerHTML=pickedRoles.map(r=>`<span style="background:${roleColors[r]||"#888"};color:#fff;padding:2px 8px;border-radius:10px;font-size:.6rem;font-weight:700;">${r}</span>`).join("");
      }else{
        roleEl.innerHTML="";
      }
    }
    // Counter-pick suggestions: in round 2+, suggest picks that counter enemy.
    const cpEl=$("draftCounterPicks");
    if(cpEl){
      // Use enemy's previous round picks for counter-pick analysis.
      const enemyUnits=this.prevEnemyPicks||null;
      if(enemyUnits&&enemyUnits.length>0&&Match.round>1){
        const suggestions=this._getCounterPickSuggestions(this.currentOffering,enemyUnits);
        if(suggestions.length>0){
          cpEl.style.display="block";
          cpEl.innerHTML="<span style='color:var(--accent);font-weight:700;'>🎯 Counter picks vs last enemy:</span> "+
            suggestions.map(s=>`<span style="color:${s.color};font-weight:700;">${s.name}</span> <span style="color:var(--muted);">(${s.reason})</span>`).join(" · ");
        }else{
          cpEl.style.display="none";
        }
      }else{
        cpEl.style.display="none";
      }
    }
    // Phase 19a: comeback banner for 4th draw.
    const cb=$("comebackBanner");
    if(cb)cb.style.display=st.drawCount===4?"block":"none";
    // Army power preview: shows current picks' total power and role coverage.
    const previewEl=$("draftArmyPreview");
    if(previewEl){
      const pickedUnits=st.picks.filter(p=>!p._isSpell);
      if(pickedUnits.length>0){
        previewEl.style.display="block";
        // Calculate power score.
        let power=0;
        const roles=new Set();
        for(const u of pickedUnits){
          const lvl=this.unitLevel(u.n);
          const hp=u.h*(1+0.1*lvl),dmg=u.d*(1+0.1*lvl);
          let s=hp*0.5+dmg*2+u.r*0.3+u.s*0.2+u.a*5+(u.crit||0)*20;
          const abBonus={none:0,splash:15,heal:20,dodge:25,poison:15,spawn:20,lifesteal:20,explode:15,heal_burst:20,shield:25,rage:20,slow:10,ramp:25,thorns:15,blink_strike:25,frenzy:20,regen:15,cleanse:15,taunt:20,executioner:25,chain_lightning:25};
          s+=abBonus[u.ability]||0;
          s+=u.rar==="legendary"?30:u.rar==="rare"?15:0;
          power+=s;
          if(u.role)roles.add(u.role);
        }
        const roleText=Array.from(roles).join(", ");
        const remaining=st.drawCount-st.drawIndex;
        previewEl.innerHTML=`<span style="color:var(--accent2);font-weight:700;">⚔️ Army Power: ${Math.round(power)}</span> · Roles: ${roleText||"none"} · ${remaining} pick${remaining!==1?"s":""} left`;
      }else{
        previewEl.style.display="none";
      }
    }
    this.updateRerollUI();
  },

  // Get counter-pick suggestions based on enemy composition.
  _getCounterPickSuggestions(offering,enemyUnits){
    const suggestions=[];
    // Analyze enemy composition.
    const enemyRoles={};
    const enemyAbilities={};
    for(const u of enemyUnits){
      if(!u)continue;
      if(u.role)enemyRoles[u.role]=(enemyRoles[u.role]||0)+1;
      if(u.ability&&u.ability!=="none")enemyAbilities[u.ability]=(enemyAbilities[u.ability]||0)+1;
    }
    for(const u of offering){
      if(!u||u._isSpell)continue;
      let reason=null;
      // Counter enemy carries with counter/assassin units.
      if((enemyRoles["carry"]||0)>=1&&u.role==="counter"){
        reason="dives enemy carries";
      }
      // Counter enemy healing with executioner (high damage to finish through heals).
      else if((enemyAbilities["heal"]||0)>0&&u.ability==="executioner"){
        reason="executes through healing";
      }
      // Counter enemy frontline with splash damage.
      else if((enemyRoles["frontline"]||0)>=1&&u.ability==="splash"){
        reason="splash vs tanky frontline";
      }
      // Counter enemy dodge with splash (can't dodge AoE).
      else if((enemyAbilities["dodge"]||0)>0&&u.ability==="splash"){
        reason="splash bypasses dodge";
      }
      // Counter enemy shield with poison (DoT ignores shield).
      else if((enemyAbilities["shield"]||0)>0&&u.ability==="poison"){
        reason="poison bypasses shield";
      }
      // Counter enemy lifesteal with burst damage (executioner).
      else if((enemyAbilities["lifesteal"]||0)>0&&u.ability==="executioner"){
        reason="burst vs lifesteal";
      }
      // Counter enemy ramp with stun/slow.
      else if((enemyAbilities["ramp"]||0)>0&&u.ability==="slow"){
        reason="slows ramp units";
      }
      // Counter enemy cluster with chain lightning.
      else if(enemyUnits.filter(u=>u&&u.h>0).length>=3&&u.ability==="chain_lightning"){
        reason="chain vs clustered enemy";
      }
      // Counter enemy taunt with ranged units.
      else if((enemyAbilities["taunt"]||0)>0&&u.r>100){
        reason="ranged vs taunt";
      }
      // Suggest frontline if enemy has many carries.
      else if((enemyRoles["carry"]||0)>=2&&u.role==="frontline"){
        reason="tanks vs enemy carries";
      }
      // Suggest support if enemy has high damage.
      else if((enemyRoles["carry"]||0)>=1&&u.role==="support"){
        reason="sustain vs enemy damage";
      }
      if(reason){
        suggestions.push({name:u.n,color:u.c,reason});
      }
    }
    return suggestions.slice(0,3);
  },

  // Phase 9/16: draft card onclick — pick this unit, advance to next draw.
  // Phase 16: highlights picks that fill missing roles in current round army.
  draftCard(u){
    const card=document.createElement("div");
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.setAttribute("aria-label",u._isSpell?"Spell: "+u.name:"Unit: "+u.n);
    // Phase 23: spell card rendering.
    if(u._isSpell){
      card.className="card rar-rare";
      const effectDesc=u.effect.replace(/_/g," ");
      const triggerDesc=u.trigger.replace(/_/g," ");
      card.innerHTML=
        `<div class="rarityTag rare">SPELL</div>`+
        `<div class="title" style="color:#fa4">✨ ${u.name}</div>`+
        `<div class="detail">${effectDesc}<br><span style="color:var(--accent2)">${triggerDesc}</span><br><span style="color:var(--muted)">${u.fxType}</span></div>`;
      card.style.borderColor="#fa4";
      card.onclick=()=>this.pickDraft(u);
      return card;
    }
    card.className="card rar-"+u.rar;
    // Phase 16: check if this unit fills a missing role (only after first pick).
    const pickedRoles=this.roundDraftState.picks.map(p=>p.role);
    const missingRole=this.roundDraftState.picks.length>0&&!pickedRoles.includes(u.role);
    const roleFillHint=missingRole?`<br><span style="color:var(--ok)">fills ${u.role}</span>`:"";
    const abLabel=u.ability&&u.ability!=="none"?`<br><span style="color:var(--accent2)">${u.ability}</span>`:"";
    const roleLabel=u.role?`<br><span style="color:var(--muted)">${u.role}</span>`:"";
    // Count badge: each pick deploys 3 copies.
    const countBadge=`<div class="cardCount">×3</div>`;
    card.innerHTML=
      countBadge+
      `<div class="rarityTag ${u.rar}">${u.rar.toUpperCase()}</div>`+
      `<div class="title" style="color:${u.c}">${u.n}</div>`+
      `<div class="detail">${u.h} HP · ${u.d} DMG<br>R${u.r} · 💰${u.cost}${abLabel}${roleLabel}${roleFillHint}</div>`;
    if(missingRole)card.style.borderColor="var(--ok)";
    // Custom tooltip (hover + tap) — shows full stats + ability description.
    CardTooltip.attach(card,()=>CardTooltip.unitHtml(u));
    card.onclick=()=>this.pickDraft(u);
    return card;
  },

  // Phase 9: reroll re-rolls the current draw's cards.
  reroll(){
    if(this.rerolls<=0){GameAudio.sfx("error");return;}
    this.rerolls--;
    GameAudio.sfx("reroll");
    this._draftPicking=false; // Reset picking flag
    this._clearDraftTimer();
    this.drawOne(); // re-rolls the current offering
  },

  updateRerollUI(){
    setText("rerollsLeft",this.rerolls);
    const rb=$("rerollButton");
    if(rb)rb.disabled=this.rerolls<=0;
  },

  // Phase 13: rarity-weighted draw from the loadout (4 cards).
  // Excludes names already used in this draw (no dupes within a draw).
  rollOne(usedNames){
    // Phase 23: 30% chance to roll a spell from spellbook (if any).
    const spellbook=this.save.spellbook||[];
    const availableSpells=spellbook.filter(s=>!usedNames.has(s.name));
    if(availableSpells.length&&R()<0.3){
      const spell=availableSpells[F(R()*availableSpells.length)];
      return {...spell,_isSpell:true};
    }
    const pool=this.loadoutUnits();
    if(pool.length===0){
      // Empty loadout — fall back to base units so the draft always offers a card.
      const base=this.base||[];
      if(base.length===0)return null;
      return {...base[F(R()*base.length)]};
    }
    const roll=R();
    const rar=roll<0.7?"common":(roll<0.95?"rare":"legendary");
    let candidates=pool.filter(u=>u.rar===rar&&!usedNames.has(u.n));
    if(candidates.length===0)candidates=pool.filter(u=>!usedNames.has(u.n));
    if(candidates.length===0)candidates=pool; // edge case: tiny pool
    if(candidates.length===0)return cloneUnit(this.base[0]); // ultimate fallback
    return cloneUnit(candidates[F(R()*candidates.length)]);
  },

  // Phase 10: build an army from survivors + new picks (1 copy per pick).
  // Phase 23: spells are separated from units.
  buildArmy(){
    const result=this._buildArmyFromPicks(this.selected,true,true);
    this.playerSpells=result.spells;
    // Combine survivors with new picks.
    const survivors=this.playerSurvivors.map(u=>{
      const clean={...u};
      delete clean._isSurvivor;
      delete clean.team;
      delete clean.deathT;
      delete clean.animState;
      delete clean.cool;
      delete clean.abCool;
      delete clean.poison;
      delete clean.shieldActive;
      delete clean.hitFlash;
      delete clean.lungeT;
      delete clean.dmgDealt;
      delete clean.kills;
      delete clean.lastAttacker;
      clean.h=clean.mh; // heal to full between rounds
      return clean;
    });
    return [...survivors,...result.units];
  },

  // Phase 9/14: build a bot army from enemy survivors + bot picks (1 copy each).
  buildBotArmy(){
    const botPicks=this._draftBotPicks.length?this._draftBotPicks:Bot.draftRound(Match.comebackEligible()?4:3);
    const result=this._buildArmyFromPicks(botPicks,false,false);
    this.enemySpells=result.spells;
    // Combine enemy survivors with new picks.
    const survivors=this.enemySurvivors.map(u=>{
      const clean={...u};
      delete clean._isSurvivor;
      delete clean.team;
      delete clean.deathT;
      delete clean.animState;
      delete clean.cool;
      delete clean.abCool;
      delete clean.poison;
      delete clean.shieldActive;
      delete clean.hitFlash;
      delete clean.lungeT;
      delete clean.dmgDealt;
      delete clean.kills;
      delete clean.lastAttacker;
      clean.h=clean.mh; // heal to full between rounds
      return clean;
    });
    return [...survivors,...result.units];
  },

  // Phase 22: role-based formation y-bands.
  // Player: frontline at low y (front=toward enemy at top), carry at high y (back).
  // Enemy: frontline at high y (front=toward player at bottom), carry at low y (back).
  _formationY(role,isPlayer){
    const FORMATION_PLAYER={
      frontline:[350,420], counter:[400,470], utility:[440,500], carry:[470,530], support:[490,540]
    };
    const FORMATION_ENEMY={
      frontline:[130,200], counter:[90,160], utility:[60,120], carry:[40,100], support:[30,80]
    };
    const bands=isPlayer?FORMATION_PLAYER:FORMATION_ENEMY;
    return bands[role]||bands.frontline;
  },

  // Helper: build an army from picks (1 copy per pick, positioned by role).
  // Phase 23: separates spells from units, returns {units, spells}.
  _buildArmyFromPicks(picks,applyUpg,isPlayer){
    const out=[];
    const spells=[];
    for(const pick of picks||[]){
      if(!pick)continue;
      if(pick._isSpell){spells.push(pick);continue;} // Phase 23: skip spells
      const [yMin,yMax]=this._formationY(pick.role,isPlayer);
      const u=applyUpg?this.applyUpgrades(cloneUnit(pick)):cloneUnit(pick);
      const xSpread=Q(40,160); // player left, enemy right (mirrored below)
      const xPos=isPlayer?xSpread:400-xSpread;
      out.push({...u,x:xPos,y:Q(yMin,yMax),h:u.h,mh:u.h});
    }
    // Safety: if all picks were spells, add a default unit so the army isn't empty.
    if(out.length===0&&this.playerSurvivors.length===0&&isPlayer){
      const fallback=cloneUnit(this.base[0]);
      const [yMin,yMax]=this._formationY(fallback.role,isPlayer);
      out.push({...fallback,x:isPlayer?Q(40,160):400-Q(40,160),y:Q(yMin,yMax),h:fallback.h,mh:fallback.h});
    }
    return {units:out,spells};
  },

  // Phase 14: show scout screen before battle. Generates opponent picks.
  battle(){
    const myArmy=this.buildArmy();
    // Phase 5: host-authoritative multiplayer.
    if(connected&&role==="host"){
      this.pendingHostArmy=myArmy;
      // Generate bot/host picks for scout, then wait for guest deck.
      this.generateScoutPicks();
      this.showScout();
      transmit("request_deck",{});
      // If guest deck already arrived (guest finished drafting first), start now.
      if(this._pendingGuestDeck){
        this.startHostBattle(this._pendingGuestDeck.selected,this._pendingGuestDeck.upgrades);
      }
      return;
    }
    if(connected&&role==="guest"){
      this.generateScoutPicks();
      this.showScout();
      const upgrades={};
      for(const p of this.selected||[]){if(!p._isSpell)upgrades[p.n]=this.unitLevel(p.n);}
      transmit("deck",{selected:this.selected,upgrades});
      return;
    }
    // Phase 9/14: bot match — generate bot picks for scout, then show scout.
    if(!Bot.loadout.length)Bot.generateLoadout(this.arenas[this.save.arena||0]?.botPool||this.base.map(u=>u.n));
    this.generateScoutPicks();
    this.showScout();
  },

  // Phase 14/21: generate opponent picks for the scout screen.
  generateScoutPicks(){
    // In P2P, opponent picks are sent by the host — don't generate bot picks.
    if(connected&&(role==="host"||role==="guest")){
      // Host: generate placeholder bot picks for scout (guest's real picks arrive via deck).
      // Guest: opponent picks arrive via opponent_picks message.
      if(role==="host"){
        const botComeback=Match.history.length>0&&Match.history[Match.history.length-1].winner==="player";
        this.opponentPicks=Bot.draftRound(botComeback?4:3,this.prevPlayerPicks||null);
        // Don't send bot picks to guest — guest already has host's real
        // previous-round picks from the round_start message.
      }
      // Guest: keep opponentPicks from round_start/opponent_picks message.
      return;
    }
    // Bot match: generate bot picks for scout.
    const botComeback=Match.history.length>0&&Match.history[Match.history.length-1].winner==="player";
    const drawCount=botComeback?4:3;
    const scoutIntel=this.prevPlayerPicks||null;
    this.opponentPicks=Bot.draftRound(drawCount,scoutIntel);
  },

  // Phase 14: render the scout screen with opponent's picks + sprite previews.
  showScout(){
    this.screen("scout");
    Quests.track("scout"); // Phase 33
    // Update lives HUD on scout screen too.
    const ph=$("scoutPlayerHearts");
    if(ph)ph.innerHTML=this.livesHearts(Match.livesPlayer,DEFAULT_LIVES);
    const eh=$("scoutEnemyHearts");
    if(eh)eh.innerHTML=this.livesHearts(Match.livesEnemy,DEFAULT_LIVES);
    const area=$("scoutArea");
    if(!area)return;
    area.innerHTML="";
    // F5: Progressive reveal — cards start face-down, tap to reveal.
    const revealed=new Set();
    const revealAll=()=>{
      for(let i=0;i<this.opponentPicks.length;i++){
        if(!revealed.has(i))revealCard(i);
      }
    };
    const revealCard=(i)=>{
      if(revealed.has(i))return;
      revealed.add(i);
      const u=this.opponentPicks[i];
      if(!u)return;
      const card=area.children[i];
      if(!card)return;
      const abIcons={none:"",splash:"💥",heal:"💚",dodge:"💨",poison:"☠️",spawn:"✨",lifesteal:"🩸",explode:"💣",heal_burst:"💖",shield:"🛡️",rage:"😤",slow:"🐌",ramp:"📈",thorns:"🌵",blink_strike:"⚡",frenzy:"🔥",regen:"🌿",cleanse:"🧹",taunt:"📣",executioner:"🗡️",chain_lightning:"🌩️"};
      const abIcon=abIcons[u.ability]||"";
      const abLabel=u.ability&&u.ability!=="none"?`<br><span style="color:#0ff">${abIcon} ${u.ability}</span>`:"";
      const abDesc=u.ability&&u.ability!=="none"&&ABILITY_DESCRIPTIONS?.[u.ability]?`<br><span style="color:#888;font-size:.6rem">${ABILITY_DESCRIPTIONS[u.ability]}</span>`:"";
      const roleLabel=u.role?`<br><span style="color:#888">${u.role}</span>`:"";
      card.innerHTML=
        `<div class="rarityTag ${u.rar}">${u.rar.toUpperCase()}</div>`+
        `<canvas width="48" height="48" style="display:block;margin:2px auto;"></canvas>`+
        `<div class="title" style="color:${u.c}">${u.n}</div>`+
        `<div class="detail">${u.h} HP · ${u.d} DMG<br>R${u.r}${abLabel}${abDesc}${roleLabel}</div>`;
      SpriteRenderer.renderPreview(card.querySelector("canvas"),u);
    };
    for(let i=0;i<this.opponentPicks.length;i++){
      const idx=i;
      const card=document.createElement("div");
      card.className="card";
      card.style.cursor="pointer";
      card.innerHTML=`<div style="height:60px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">❓</div><div class="detail" style="text-align:center;">${t("tap_to_reveal")}</div>`;
      card.onclick=()=>revealCard(idx);
      area.appendChild(card);
    }
    // Add "Reveal All" button.
    const revealBtn=document.createElement("button");
    revealBtn.className="btn";
    revealBtn.textContent=t("reveal_all");
    revealBtn.style.cssText="margin-top:10px;";
    revealBtn.onclick=()=>{revealAll();revealBtn.remove();this._renderWinPrediction(area);};
    area.appendChild(revealBtn);
  },
  // Win prediction: compares player army power vs enemy army power.
  _renderWinPrediction(area){
    // Remove existing prediction.
    const existing=area.querySelector("#winPrediction");
    if(existing)existing.remove();
    const playerUnits=(this.selected||[]).filter(u=>u&&!u._isSpell);
    const enemyUnits=(this.opponentPicks||[]).filter(u=>u&&!u._isSpell);
    if(playerUnits.length===0||enemyUnits.length===0)return;
    // Calculate army power scores.
    const scoreArmy=units=>{
      let score=0;
      for(const u of units){
        const lvl=this.unitLevel(u.n);
        const hp=u.h*(1+0.1*lvl),dmg=u.d*(1+0.1*lvl);
        let s=hp*0.5+dmg*2+u.r*0.3+u.s*0.2+u.a*5+(u.crit||0)*20;
        const abBonus={none:0,splash:15,heal:20,dodge:25,poison:15,spawn:20,lifesteal:20,explode:15,heal_burst:20,shield:25,rage:20,slow:10,ramp:25,thorns:15,blink_strike:25,frenzy:20,regen:15,cleanse:15,taunt:20,executioner:25,chain_lightning:25};
        s+=abBonus[u.ability]||0;
        s+=u.rar==="legendary"?30:u.rar==="rare"?15:0;
        score+=s;
      }
      return score;
    };
    const playerScore=scoreArmy(playerUnits);
    const enemyScore=scoreArmy(enemyUnits);
    const total=playerScore+enemyScore;
    const winChance=total>0?Math.round(playerScore/total*100):50;
    // Color based on win chance.
    const color=winChance>=60?"var(--ok)":winChance>=40?"var(--warn)":"var(--danger)";
    const label=winChance>=65?"Favored":winChance>=55?"Slight Edge":winChance>=45?"Even Match":winChance>=35?"Tough Fight":"Outmatched";
    const pred=document.createElement("div");
    pred.id="winPrediction";
    pred.style.cssText="margin-top:12px;padding:12px;border-radius:var(--radius);background:var(--card);border:1px solid "+color+";text-align:center;";
    pred.innerHTML=
      `<div style="font-weight:700;font-size:.85rem;color:${color};margin-bottom:6px;">⚔️ Battle Prediction: ${label}</div>`+
      `<div style="font-size:1.2rem;font-weight:700;color:${color};">${winChance}% win chance</div>`+
      `<div style="height:12px;background:var(--bg);border-radius:6px;overflow:hidden;margin:8px 0;">`+
      `<div style="width:${winChance}%;height:100%;background:${color};border-radius:6px;transition:width .3s;"></div></div>`+
      `<div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted);">`+
      `<span>Your Army: ${Math.round(playerScore)} power</span>`+
      `<span>Enemy: ${Math.round(enemyScore)} power</span></div>`;
    area.appendChild(pred);
  },

  // Phase 14: proceed from scout to actual battle.
  startBattle(){
    // Phase 21: store player's picks for bot counter-picking next round.
    this.prevPlayerPicks=this.selected?[...this.selected]:null;
    // Store enemy's picks for counter-pick suggestions next round.
    this.prevEnemyPicks=this.opponentPicks?[...this.opponentPicks]:null;
    // Apply saved default battle speed.
    const savedSpeed=this.save.defaultSpeed||1;
    Battle.speed=savedSpeed;
    const sb=$("speedBtn");
    if(sb)sb.textContent=savedSpeed+"×";
    // Store win prediction for accuracy tracking.
    const predEl=document.getElementById("winPrediction");
    if(predEl){
      const match=predEl.innerText.match(/(\d+)% win chance/);
      if(match)this._lastPrediction=parseInt(match[1]);
    }
    GameAudio.init();GameAudio.stopMusic();GameAudio.startMusic(); // Phase 30 + I1: switch to battle music
    const myArmy=this.buildArmy();
    // Phase 5: host-authoritative multiplayer.
    // BUGFIX: set pendingHostArmy + send request_deck so the guest's deck reply
    // triggers startHostBattle. Without this, the host shows the battle screen
    // but never starts the sim (pendingHostArmy was only set in battle(), which
    // is the old scout-screen flow — startBattle() is the continuous-draft flow).
    if(connected&&role==="host"){
      this.pendingHostArmy=myArmy;
      this.screen("battle");
      this.updateLivesHUD();
      setText("turn","WAIT");
      setText("battleHP",myArmy.length);
      setText("battleEnemy","?");
      transmit("request_deck",{});
      // If guest deck already arrived (guest finished drafting first), start now.
      if(this._pendingGuestDeck){
        this.startHostBattle(this._pendingGuestDeck.selected,this._pendingGuestDeck.upgrades);
      }
      return;
    }
    if(connected&&role==="guest"){
      this.screen("battle");
      this.updateLivesHUD();
      setText("turn","WAIT");
      setText("battleHP","?");
      setText("battleEnemy","?");
      return;
    }
    // Phase 9: bot match — build enemy army from enemy survivors + bot picks.
    const enemies=this.buildBotArmy();
    this.screen("battle");
    this.updateLivesHUD();
    // DET: solo mode — local team is always "player". Reset in case the player
    // was previously a guest in lockstep (which sets _localTeam="enemy").
    Battle._localTeam="player";
    Battle._lockstepActive=false;
    // Phase 23: pass spells to Battle.start.
    const spells={player:this.playerSpells||[],enemy:this.enemySpells||[]};
    Battle.start(myArmy,enemies,winner=>this.onBattleEnd(winner),spells);
  },

  // Phase 5: host assembles the full battle once the guest's deck arrives.
  // DET: when both peers support determinism, start lockstep (both run the sim,
  // sync only commands). Otherwise fall back to host-authoritative snapshots.
  startHostBattle(guestSelected,guestUpgrades){
    this._pendingGuestDeck=null; // consume pending deck
    // Continuous draft: combine guest's survivors (enemy team in sim) with new picks.
    // The host's enemySurvivors contains the guest's units from previous rounds
    // (in lockstep, both peers run the same sim → host has full state).
    const guestNew=this.buildArmyFromSelected(guestSelected,guestUpgrades);
    const guestSurvivors=this.enemySurvivors.map(u=>{
      const clean={...u};
      delete clean._isSurvivor;
      delete clean.team;
      delete clean.deathT;
      delete clean.animState;
      delete clean.cool;
      delete clean.abCool;
      delete clean.poison;
      delete clean.shieldActive;
      delete clean.hitFlash;
      delete clean.lungeT;
      delete clean.dmgDealt;
      delete clean.kills;
      delete clean.lastAttacker;
      clean.h=clean.mh; // heal to full between rounds
      return clean;
    });
    const guestArmy=[...guestSurvivors,...guestNew];
    // Phase 23: pass spells (host = player, guest = enemy).
    const spells={player:this.playerSpells||[],enemy:this.enemySpells||[]};
    // NETHARDEN: helper to start battle with error notification to peer.
    const safeStart=(armyP,armyE,cb,sp)=>{
      try{
        Battle.start(armyP,armyE,cb,sp);
      }catch(e){
        console.error("[P2P] Battle.start failed:",e);
        showError("Battle failed to start: "+(e&&e.message||e));
        transmit("battle_error",{msg:"Battle start failed"});
        Battle.stop();
        Match.active=false;
        this.screen("menu");
      }
    };
    // DET: lockstep is the primary mode (like Clash Royale). Both peers run the
    // sim from the same seed + armies, syncing only commands. This gives the
    // lowest bandwidth (~200 bytes/s) and lowest input latency (3 ticks).
    // Requires determinism (DMath, rand, stateHash) — we've eliminated all known
    // desync bugs, so this is the right default.
    if(_peerDetCapable&&!Battle._desyncFallback){
      // Host shares both armies + spells so the guest starts from identical state.
      // Sim labeling is the host's on both peers (host=player, guest=enemy) →
      // identical unit array order + team tags → deterministic.
      const payload={
        playerArmy:serializeArmyForPeer(this.pendingHostArmy),
        enemyArmy:serializeArmyForPeer(guestArmy),
        playerSpells:spells.player,enemySpells:spells.enemy,
        round:Match.round,seed:Match.seed
      };
      transmit("lockstep_start",payload);
      Battle._localTeam="player";
      Battle._lockstepActive=true;
      Battle._useRelay=false;
      safeStart(this.pendingHostArmy,guestArmy,winner=>this.onBattleEnd(winner),spells);
      this.updateLivesHUD();
      // No snapshots in lockstep mode — both peers run the sim independently.
      return;
    }
    // RELAY: fallback mode — used when desync is detected (_desyncFallback=true)
    // or when peer doesn't support determinism. Only host runs the sim, guest
    // renders from state snapshots. Higher bandwidth (~30KB/s) but no determinism
    // required. The relay improvements (spell CD sync, pause/speed sync,
    // immediate snapshot, reconnect) benefit this fallback path.
    if(_peerRelayCapable||_peerDetCapable){
      const payload={
        playerSpells:spells.player,enemySpells:spells.enemy,
        round:Match.round
      };
      transmit("relay_start",payload);
      Battle._useRelay=true;
      Battle._localTeam="player";
      Battle._lockstepActive=false;
      safeStart(this.pendingHostArmy,guestArmy,winner=>this.onBattleEnd(winner),spells);
      this.updateLivesHUD();
      this.startSnapshots();
      // Send an immediate snapshot so the guest doesn't see an empty screen.
      const immediateSnap=Battle.compressedSnapshot();
      immediateSnap.round=Match.round;
      immediateSnap.livesPlayer=Match.livesPlayer;
      immediateSnap.livesEnemy=Match.livesEnemy;
      immediateSnap.drawIndex=G.roundDraftState?.drawIndex||0;
      transmit("snap",immediateSnap);
      return;
    }
    // Legacy fallback: peer doesn't support relay or determinism.
    Battle._localTeam="player";
    safeStart(this.pendingHostArmy,guestArmy,winner=>this.onBattleEnd(winner),spells);
    this.updateLivesHUD();
    this.startSnapshots();
  },

  buildArmyFromSelected(selected,guestUpgrades){
    const out=[];
    const spells=[];
    for(const pick of selected){
      if(!pick)continue;
      if(pick._isSpell){spells.push(pick);continue;} // Phase 23
      const [yMin,yMax]=this._formationY(pick.role,false);
      const u=guestUpgrades?this._applyUpgradeLevel(cloneUnit(pick),guestUpgrades[pick.n]||0):this.applyUpgrades(cloneUnit(pick));
      const xSpread=Q(40,160);
      out.push({...u,x:400-xSpread,y:Q(yMin,yMax),h:u.h,mh:u.h});
    }
    // Safety: if all picks were spells, add a default unit so the army isn't empty.
    if(out.length===0){
      const fallback=cloneUnit(this.base[0]);
      const [yMin,yMax]=this._formationY(fallback.role,false);
      out.push({...fallback,x:400-Q(40,160),y:Q(yMin,yMax),h:fallback.h,mh:fallback.h});
    }
    this.enemySpells=spells; // Phase 23: store guest spells
    return out;
  },

  // Phase 5: host broadcasts full state at 20Hz (every 50ms).
  // Phase 18: snapshot includes match state (round, lives, drawIndex).
  startSnapshots(){
    this.stopSnapshots();
    this.snapTimer=setInterval(()=>{
      if(!Battle.running){this.stopSnapshots();return;}
      const snap=Battle.compressedSnapshot(); // J3: compressed for bandwidth
      snap.round=Match.round;
      snap.livesPlayer=Match.livesPlayer;
      snap.livesEnemy=Match.livesEnemy;
      snap.drawIndex=G.roundDraftState?.drawIndex||0;
      transmit("snap",snap);
    },50);
  },
  stopSnapshots(){
    if(this.snapTimer){clearInterval(this.snapTimer);this.snapTimer=null;}
  },

  // NETFIX: unified survivor cleanup — removes transient battle state from units.
  // Used for both player and enemy survivors (was duplicated inline).
  _cleanSurvivors(allUnits,team){
    return allUnits.filter(u=>u.team===team).map(u=>{
      const clean={...u};
      delete clean.cool;delete clean.abCool;delete clean.poison;delete clean.poisonTick;
      delete clean.regen;delete clean.regenTick;delete clean.slow;delete clean.stun;
      delete clean.shieldActive;delete clean.deathT;delete clean.animState;delete clean.animT;
      delete clean.attackT;delete clean.movedThisFrame;delete clean.attackedThisFrame;
      delete clean.prevX;delete clean.prevY;delete clean.prevH;delete clean.spawnT;
      delete clean.hitFlash;delete clean.lungeT;delete clean.lungeDir;delete clean.abFlash;
      delete clean.abFlashColor;delete clean.dmgDealt;delete clean.kills;delete clean.lastAttacker;
      delete clean.hitReact;delete clean.hitReactDir;delete clean._buffDmgApplied;
      delete clean._buffSpeedApplied;delete clean._baseSpeedMod;delete clean.firstHitUsed;
      delete clean.hasBeenHit;delete clean.patrolT;delete clean.team;
      if(clean._baseS){clean.s=clean._baseS;delete clean._baseS;} // restore base speed (undo arena boost)
      return clean;
    });
  },

  // Phase 8: Battle ended — delegate to Match for round/match logic.
  onBattleEnd(winner){
    this.stopSnapshots();
    // Continuous draft: store ALL units for next round (killed units revive).
    // Use _allUnits which tracks every unit (dead units are removed from Battle.units
    // after death animation, but kept in _allUnits for revival).
    // NETFIX: unified survivor cleanup — was 2 identical blocks (player/enemy).
    if(Match.active){
      const allUnits=Battle._allUnits||Battle._finalUnits||Battle.units||[];
      this.playerSurvivors=this._cleanSurvivors(allUnits,"player");
      this.enemySurvivors=this._cleanSurvivors(allUnits,"enemy");
      // DET: in lockstep, sim uses host's team labeling (player=host, enemy=guest).
      // Swap survivor arrays for the guest so playerSurvivors = guest's own units.
      if(connected&&role==="guest"&&Battle._lockstepActive){
        const tmp=this.playerSurvivors;
        this.playerSurvivors=this.enemySurvivors;
        this.enemySurvivors=tmp;
      }
    }
    // Phase 16: accumulate death log across rounds for post-match hint.
    if(Battle.deathLog&&Battle.deathLog.length){
      if(!Match.deathLog)Match.deathLog=[];
      Match.deathLog.push(...Battle.deathLog);
    }
    // Phase 19a: track last surviving player unit's role for Role Master.
    // DET: in lockstep, winner is in host's labeling (player=host, enemy=guest).
    // Translate for the guest so we track the guest's wins, not the host's.
    const roleWinner=(connected&&role==="guest"&&Battle._lockstepActive)
      ?(winner==="enemy"?"player":winner==="player"?"enemy":"draw")
      :winner;
    if(roleWinner==="player"){
      // In P2P guest mode, the guest's units are team "enemy" in snapshots/sim.
      const teamForRole=connected&&role==="guest"?"enemy":"player";
      // Use _finalUnits snapshot — Battle.units is cleared by stop() before onBattleEnd runs.
      const finalUnits=Battle._finalUnits||Battle.units||[];
      const survivors=finalUnits.filter(u=>u.team===teamForRole&&u.h>0);
      if(survivors.length>0){
        let lastRole=survivors[0].role;
        // Map assassin→counter and bruiser→frontline for Role Master achievement.
        const roleMap={assassin:"counter",bruiser:"frontline"};
        const mappedRole=roleMap[lastRole]||lastRole;
        if(!this.save.roleWins)this.save.roleWins={};
        this.save.roleWins[mappedRole]=(this.save.roleWins[mappedRole]||0)+1;
        saveData(this.save);
      }
    }
    // Phase 5: in multiplayer the host already broadcast the final winner;
    // guests reach here via the snapshot path with a translated winner.
    // P2P guest: host sends round_end/match_end messages that handle state
    // updates (lives, history). Guest must NOT call Match.onRoundEnd here —
    // that would double-count history/lives (once here, once via round_end msg).
    // Guest quest/achievement tracking happens via onMatchEnd (match_end msg).
    // DET: in lockstep mode, both peers send their state hash for desync
    // detection. Guest sends here (before early return); host sends from
    // Match.onRoundEnd (avoids duplicate send — was sending twice).
    if(connected&&_peerDetCapable&&Battle._lockstepActive&&role==="guest"){
      const myHash=Battle.stateHash();
      const myMerkle=Battle.merkleTree();
      transmit("round_hash",{round:Match.round,winner,hash:myHash,merkle:{root:myMerkle.root,player:myMerkle.player,enemy:myMerkle.enemy,playerNodes:myMerkle.playerNodes,enemyNodes:myMerkle.enemyNodes}});
    }
    if(connected&&role==="guest"){
      return;
    }
    if(Match.active){
      Match.onRoundEnd(winner);
    }else{
      // Fallback (no active match — shouldn't happen, but safety net).
      this.onMatchEnd(winner);
    }
  },

  // Phase 8: Round result (mid-match) — show lives, "NEXT ROUND" button.
  roundResult(winner,livesPlayer,livesEnemy){
    this.screen("result");
    const win=winner==="player";
    setText("resultTitle",win?t("round_won"):t("round_lost"));
    GameAudio.sfx(win?"round_win":"round_lose"); // Phase 30
    GameAudio.stopMusic(); // Phase 30: stop battle music
    const lr=$("livesResult");
    if(lr)lr.innerText=`You ${this.livesHearts(livesPlayer,DEFAULT_LIVES)} | Enemy ${this.livesHearts(livesEnemy,DEFAULT_LIVES)}`;
    // Show army count (continuous draft — all units revive and carry over).
    const sr=$("survivorInfo");
    if(sr){
      const ps=this.playerSurvivors.length,es=this.enemySurvivors.length;
      sr.innerText=`Army — You: ${ps} | Enemy: ${es}`;
      sr.style.display=ps>0||es>0?"block":"none";
    }
    // Hide match rewards (awarded on match end, not round end).
    const rw=$("matchRewards");if(rw)rw.style.display="none";
    const mm=$("matchMenu");if(mm)mm.style.display="none";
    const share=$("matchShare");if(share)share.style.display="none";
    const nr=$("nextRound");
    if(nr){
      nr.style.display="block";
      if(connected&&role==="guest"){
        nr.innerText="WAITING FOR HOST...";
        nr.disabled=true;
        nr.onclick=null;
      }else{
        nr.innerText="NEXT ROUND";
        nr.disabled=false;
        nr.onclick=()=>{Match.startRound();};
      }
    }
    // 5 XP consolation for losing a round (softens comebacks).
    if(!win){
      this.save.xp=(this.save.xp||0)+5;
      saveData(this.save);
    }
  },

  // Phase 8: Match ended — award XP/coins, show match result, update wins.
  onMatchEnd(winner){
    const win=winner==="player";
    const draw=winner==="draw";
    GameAudio.sfx(win?"match_win":draw?"match_lose":"match_lose"); // Phase 30
    GameAudio.stopMusic(); // Phase 30
    // Clear survivors on match end.
    this.playerSurvivors=[];
    this.enemySurvivors=[];
    // Track win prediction accuracy.
    if(this._lastPrediction!==undefined){
      if(!this.save.predStats)this.save.predStats={correct:0,total:0,avgError:0};
      const ps=this.save.predStats;
      const actual=win?100:0;
      const error=Math.abs(this._lastPrediction-actual);
      ps.total++;
      // "Correct" if prediction was >50% and won, or <50% and lost.
      if((this._lastPrediction>50&&win)||(this._lastPrediction<50&&!win)||(this._lastPrediction===50)){
        ps.correct++;
      }
      ps.avgError=Math.round((ps.avgError*(ps.total-1)+error)/ps.total);
      saveData(this.save);
      this._lastPrediction=undefined;
    }
    // Phase 33: quest tracking + streak check (handles midnight rollover).
    Quests.checkStreak();
    if(win)Quests.track("match_win");
    if(Match.history.length>=5)Quests.track("round_reach",5);
    // Phase 35: analytics.
    Analytics.track("match_end",{winner,rounds:Match.history.length});
    // Phase 37: save replay.
    this.saveReplay(winner);
    // Phase 38: interstitial ad every 3 matches.
    this.save.matchCount=(this.save.matchCount||0)+1;
    if(this.save.matchCount%3===0)AdSDK.showInterstitial();
    let xpGain=0,coinGain=0,arenaAdvanced=false;
    // Global stats tracking.
    if(!this.save.stats)this.save.stats={totalDmg:0,totalKills:0,totalMatches:0,totalWins:0,totalSpells:0};
    this.save.stats.totalMatches=(this.save.stats.totalMatches||0)+1;
    if(win)this.save.stats.totalWins=(this.save.stats.totalWins||0)+1;
    // Accumulate damage + kills from all player units this match.
    const playerTeam=connected&&role==="guest"?"enemy":"player";
    if(!this.save.unitMastery)this.save.unitMastery={};
    const finalUnits=Battle._finalUnits||Battle.units||[];
    for(const u of finalUnits){
      if(u.team===playerTeam){
        this.save.stats.totalDmg=(this.save.stats.totalDmg||0)+Math.round(u.dmgDealt||0);
        this.save.stats.totalKills=(this.save.stats.totalKills||0)+(u.kills||0);
        // Track per-unit mastery: total kills and damage.
        if(u.n){
          if(!this.save.unitMastery[u.n])this.save.unitMastery[u.n]={kills:0,dmg:0,matches:0};
          this.save.unitMastery[u.n].kills+=(u.kills||0);
          this.save.unitMastery[u.n].dmg+=Math.round(u.dmgDealt||0);
          this.save.unitMastery[u.n].matches++;
        }
      }
    }
    // Track spells cast.
    const finalSpells=Battle._finalSpells||Battle.spells||[];
    if(finalSpells.length)this.save.stats.totalSpells=(this.save.stats.totalSpells||0)+finalSpells.filter(s=>s.fired).length;
    // Phase 36: update Elo rating.
    const r=this.save.ranked;
    if(r){
      const oldRating=r.rating;
      r.rating=this.computeElo(r.rating,1000,draw?null:win,!connected);
      if(r.rating>r.peakRating)r.peakRating=r.rating;
      if(win)r.wins++;else if(!draw)r.losses++;
    }
    if(win){
      vibrate([40,30,40]); // Phase 7: victory haptic
      this.save.wins=(this.save.wins||0)+1;
      this.save.matchWins=(this.save.matchWins||0)+1;
      this.save._lastMatchWon=true;
      // Track the loadout used for this win (for Full Custom achievement).
      this.save._lastWinLoadout=[...(this.save.loadout||[])];
      // Win streak tracking.
      this.save.winStreak=(this.save.winStreak||0)+1;
      if(this.save.winStreak>(this.save.bestStreak||0))this.save.bestStreak=this.save.winStreak;
      // Streak bonus coins.
      if(this.save.winStreak>=3){
        const streakBonus=Math.min(50,this.save.winStreak*5);
        coinGain+=streakBonus;
      }
      // Daily challenge: first win of the day gives bonus coins.
      const today=new Date().toDateString();
      if((this.save.lastDailyWin||"")!==today){
        this.save.lastDailyWin=today;
        const dailyBonus=100;
        coinGain+=dailyBonus;
        setTimeout(()=>toast(`🎁 Daily challenge complete! +${dailyBonus}💰`),600);
      }
      xpGain=50+this.playerLevel()*10;
      coinGain+=20+F(R()*15);
      this.save.xp=(this.save.xp||0)+xpGain;
      this.save.coins=(this.save.coins||0)+coinGain;
      // Phase 15: advance to next arena if unlocked.
      const arenaIdx=this.save.arena||0;
      const nextArena=this.arenas[arenaIdx+1];
      if(nextArena&&this.save.matchWins>=nextArena.unlock){
        this.save.arena=arenaIdx+1;
        arenaAdvanced=true;
        coinGain+=50; // bonus for advancing
        this.save.coins+=50;
      }else if(!nextArena){
        // Endless mode: after clearing all arenas, escalate difficulty.
        this.save.endlessLevel=(this.save.endlessLevel||0)+1;
        arenaAdvanced=true;
        coinGain+=30+this.save.endlessLevel*10; // escalating bonus
        this.save.coins+=30+this.save.endlessLevel*10;
        // Milestone bonus every 5 levels.
        if(this.save.endlessLevel%5===0){
          const milestoneBonus=100+this.save.endlessLevel*20;
          coinGain+=milestoneBonus;
          this.save.coins+=milestoneBonus;
          this._endlessMilestone=this.save.endlessLevel;
        }
      }
      saveData(this.save);
    }else if(draw){
      // Draw: award partial rewards, don't reset win streak.
      this.save._lastMatchWon=false;
      xpGain=15;
      coinGain=5;
      this.save.xp=(this.save.xp||0)+xpGain;
      this.save.coins=(this.save.coins||0)+coinGain;
      saveData(this.save);
    }else{
      // Loss: reset win streak.
      this.save._lastMatchWon=false;
      if(this.save.winStreak>0){
        this.save.winStreak=0;
        saveData(this.save);
      }
    }
    // Check achievements on every match end (not just wins) — cumulative stats
    // like totalDmg/totalKills/totalSpells increase on losses and draws too.
    this.checkAchievements();
    // Show match result screen.
    this.screen("result");
    const titleEl=$("resultTitle");
    if(titleEl){
      titleEl.innerText=win?t("match_won"):draw?t("match_draw"):t("match_lost");
      titleEl.classList.remove("result-victory","result-defeat");
      // Force reflow to restart animation.
      void titleEl.offsetWidth;
      titleEl.classList.add(win?"result-victory":"result-defeat");
    }
    const lr=$("livesResult");
    if(lr)lr.innerText=`You ${this.livesHearts(Match.livesPlayer,DEFAULT_LIVES)} | Enemy ${this.livesHearts(Match.livesEnemy,DEFAULT_LIVES)}`;
    const rw=$("matchRewards");
    if(rw){
      rw.style.display="flex";
      rw.classList.remove("result-slide-up");
      void rw.offsetWidth;
      rw.classList.add("result-slide-up");
      setText("xpGain","+"+(xpGain||0));
      setText("coinGain","+"+(coinGain||0));
      if((coinGain||0)>0)setTimeout(()=>GameAudio.sfx("coin"),300);
    }
    // Phase 15: arena advancement notification.
    if(arenaAdvanced){
      if(this.save.endlessLevel){
        setTimeout(()=>toast(`♾️ Endless Level ${this.save.endlessLevel}! +${30+this.save.endlessLevel*10}💰 bonus`),500);
        if(this._endlessMilestone){
          const mb=100+this._endlessMilestone*20;
          setTimeout(()=>toast(`🌟 MILESTONE! Endless Level ${this._endlessMilestone}! +${mb}💰 bonus!`),1000);
          this._endlessMilestone=null;
        }
      }else{
        const arena=this.arenas[this.save.arena];
        if(arena)setTimeout(()=>toast(`⚔️ Unlocked ${arena.n}! +50💰 bonus`),500);
      }
    }
    // Win streak notification.
    if(win&&this.save.winStreak>=3){
      setTimeout(()=>toast(`🔥 ${this.save.winStreak}-win streak! +${Math.min(50,this.save.winStreak*5)}💰 bonus`),800);
    }
    // Damage breakdown chart: bar chart of each player unit's damage.
    const dmgEl=$("matchDmgChart");
    if(dmgEl){
      const playerTeam=connected&&role==="guest"?"enemy":"player";
      const _finalUnits=Battle._finalUnits||Battle.units||[];
      const units=_finalUnits.filter(u=>u.team===playerTeam&&(u.dmgDealt||0)>0)
        .sort((a,b)=>(b.dmgDealt||0)-(a.dmgDealt||0));
      if(units.length>0){
        const maxDmg=Math.max(...units.map(u=>u.dmgDealt||0));
        dmgEl.style.display="block";
        let html="<div style='font-weight:700;font-size:.8rem;margin-bottom:8px;text-align:center;'>Damage Breakdown</div>";
        for(const u of units){
          const pct=Math.round((u.dmgDealt/maxDmg)*100);
          const kills=u.kills||0;
          html+=`<div style="display:flex;align-items:center;gap:6px;margin:4px 0;">`+
            `<span style="color:${u.c};font-size:.75rem;width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.n}</span>`+
            `<div style="flex:1;background:var(--border);border-radius:4px;height:14px;overflow:hidden;">`+
            `<div style="width:${pct}%;height:100%;background:${u.c};border-radius:4px;"></div></div>`+
            `<span style="font-size:.7rem;color:var(--muted);width:60px;text-align:right;">${Math.round(u.dmgDealt)}${kills>0?` · ${kills}☠`:""}</span></div>`;
        }
        dmgEl.innerHTML=html;
      }else{
        dmgEl.style.display="none";
      }
    }
    // Round-by-round breakdown.
    const roundsEl=$("matchRounds");
    if(roundsEl&&Match.history.length>0){
      roundsEl.style.display="block";
      let html="<div style='font-weight:700;font-size:.8rem;margin-bottom:6px;text-align:center;'>Round History</div><div style='display:flex;gap:4px;justify-content:center;'>";
      for(const r of Match.history){
        const icon=r.winner==="player"?"✅":r.winner==="enemy"?"❌":"➖";
        html+=`<span style="font-size:1rem;">${icon}</span>`;
      }
      html+="</div>";
      roundsEl.innerHTML=html;
    }else if(roundsEl){
      roundsEl.style.display="none";
    }
    // Unit survival summary.
    const survEl=$("matchSurvivors");
    if(survEl){
      const playerTeam=connected&&role==="guest"?"enemy":"player";
      const _finalUnits=Battle._finalUnits||Battle.units||[];
      const survivors=_finalUnits.filter(u=>u.team===playerTeam&&u.h>0);
      const total=_finalUnits.filter(u=>u.team===playerTeam).length;
      if(total>0){
        survEl.style.display="block";
        const survNames=survivors.map(u=>`<span style="color:${u.c}">${u.n}</span>`).join(", ");
        survEl.innerHTML=`<div style='font-weight:700;font-size:.8rem;margin-bottom:4px;'>Army Status</div>`+
          `<div style='font-size:.75rem;'>${survivors.length}/${total} survived${survivors.length>0?`: ${survNames}`:" — full wipe"}</div>`;
      }else{
        survEl.style.display="none";
      }
    }
    // Phase 16: post-match strategy hint.
    const hint=this.generateMatchHint(win);
    const mh=$("matchHint");
    if(mh)mh.innerHTML=hint;
    // Detailed tactical analysis.
    this._renderMatchAnalysis(win);
    // Battle highlights.
    this._renderMatchHighlights(win);
    // Unit performance ranking.
    this._renderMatchPerformance(win);
    // Battle MVP: unit that dealt the most damage on the winning team.
    const mvpEl=$("matchMVP");
    if(mvpEl){
      const playerTeam=connected&&role==="guest"?"enemy":"player";
      const _finalUnits=Battle._finalUnits||Battle.units||[];
      const contenders=_finalUnits.filter(u=>u.team===playerTeam&&(u.dmgDealt||0)>0)
        .sort((a,b)=>(b.dmgDealt||0)-(a.dmgDealt||0));
      if(contenders.length>0){
        const mvp=contenders[0];
        const kills=mvp.kills||0;
        mvpEl.style.display="block";
        mvpEl.innerHTML=`🏆 <b>MVP: ${mvp.n}</b><br><span style="color:${mvp.c};font-size:.8rem">${mvp.role||""} · ${Math.round(mvp.dmgDealt)} dmg${kills>0?` · ${kills} kills`:""}</span>`;
      }else{
        mvpEl.style.display="none";
      }
    }
    const nr=$("nextRound");
    if(nr){
      nr.style.display="block";
      // Phase 10: forge hidden in Tier 1 (re-enabled in Phase 12).
      nr.innerText="PLAY AGAIN";
      nr.onclick=()=>{this.start();};
    }
    const mm=$("matchMenu");
    if(mm)mm.style.display="inline-block";
    // Show share button on match end.
    const share=$("matchShare");
    if(share)share.style.display="block";
  },

  // Phase 16: generate a one-line strategy hint based on loadout roles
  // and unit death order (templated from who died first + role gaps).
  generateMatchHint(win){
    const units=this.loadoutUnits();
    const roles={};
    for(const u of units)if(u.role)roles[u.role]=(roles[u.role]||0)+1;
    const deathLog=Match.deathLog||Battle.deathLog||[];
    // P2P guest: guest's units are team "enemy" in snapshots.
    const playerTeam=connected&&role==="guest"?"enemy":"player";
    const playerDeaths=deathLog.filter(d=>d.team===playerTeam);
    const firstDeath=playerDeaths[0];
    if(win){
      if(roles["frontline"]&&roles["carry"])return"💡 Solid frontline + carry combo won the day";
      if(roles["counter"])return"💡 Your counter units dove effectively";
      return"💡 Balanced play took the match";
    }
    // Loss hints: prioritize death-order insights over role gaps.
    if(firstDeath){
      // Frontline died first → frontline too weak.
      if(firstDeath.role==="frontline")
        return`💡 ${firstDeath.n} fell first — your frontline needs more HP or a support to sustain it`;
      // Carry died first → no protection.
      if(firstDeath.role==="carry")
        return`💡 ${firstDeath.n} died first — protect your carry with a frontline or counter`;
      // Support died first → frontline exposed.
      if(firstDeath.role==="support")
        return`💡 ${firstDeath.n} was picked off early — keep your support behind the frontline`;
    }
    // Fall back to role-gap analysis.
    if(!roles["frontline"])return"💡 Lost — no frontline to protect your carries. Add a tanky unit";
    if(!roles["carry"])return"💡 Lost — no ranged DPS. Add an Archer or ranged unit";
    if(!roles["support"])return"💡 Lost — no healing. A Priest could sustain your frontline";
    if(!roles["counter"])return"💡 Lost — no divers to threaten enemy carries. Add an Assassin";
    return"💡 Close match — try adjusting your loadout strategy";
  },

  // Detailed post-match tactical analysis with stats and recommendations.
  _renderMatchAnalysis(win){
    const el=$("matchAnalysis");
    if(!el)return;
    const playerTeam=connected&&role==="guest"?"enemy":"player";
    const _finalUnits=Battle._finalUnits||Battle.units||[];
    const playerUnits=_finalUnits.filter(u=>u.team===playerTeam);
    const enemyUnits=_finalUnits.filter(u=>u.team!==playerTeam);
    if(playerUnits.length===0){el.style.display="none";return;}
    el.style.display="block";
    // Calculate stats.
    const playerDmg=playerUnits.reduce((s,u)=>s+(u.dmgDealt||0),0);
    const enemyDmg=enemyUnits.reduce((s,u)=>s+(u.dmgDealt||0),0);
    const playerKills=playerUnits.reduce((s,u)=>s+(u.kills||0),0);
    const enemyKills=enemyUnits.reduce((s,u)=>s+(u.kills||0),0);
    const playerSurvivors=playerUnits.filter(u=>u.h>0).length;
    const enemySurvivors=enemyUnits.filter(u=>u.h>0).length;
    // Death order analysis.
    const deathLog=Battle.deathLog||[];
    const playerDeaths=deathLog.filter(d=>d.team===playerTeam);
    const enemyDeaths=deathLog.filter(d=>d.team!==playerTeam);
    // Build analysis sections.
    let html="<div style='font-weight:700;font-size:.85rem;margin-bottom:8px;text-align:center;'>📊 Tactical Analysis</div>";
    // Stat comparison table.
    html+="<div style='display:grid;grid-template-columns:1fr auto 1fr;gap:4px;font-size:.72rem;margin:8px 0;'>";
    html+=`<div style='text-align:right;color:var(--accent2);'>${Math.round(playerDmg)} dmg</div><div style='text-align:center;color:var(--muted);font-weight:700;'>Damage</div><div style='color:var(--warn);'>${Math.round(enemyDmg)} dmg</div>`;
    html+=`<div style='text-align:right;color:var(--accent2);'>${playerKills} kills</div><div style='text-align:center;color:var(--muted);font-weight:700;'>Kills</div><div style='color:var(--warn);'>${enemyKills} kills</div>`;
    html+=`<div style='text-align:right;color:var(--accent2);'>${playerSurvivors}/${playerUnits.length}</div><div style='text-align:center;color:var(--muted);font-weight:700;'>Survivors</div><div style='color:var(--warn);'>${enemySurvivors}/${enemyUnits.length}</div>`;
    html+="</div>";
    // Performance insights.
    const insights=[];
    if(win){
      if(playerSurvivors>=playerUnits.length*0.5)insights.push("💪 Dominant victory — most of your army survived");
      else if(playerSurvivors>0)insights.push("⚔️ Hard-fought win — close battle");
      else insights.push("🎲 Pyrrhic victory — won but lost all units");
      if(playerDmg>enemyDmg*1.5)insights.push("🔥 Overwhelming damage output");
      if(playerKills>enemyKills)insights.push("🎯 Efficient killing — more kills than deaths");
    }else{
      if(playerSurvivors===0&&enemySurvivors>0)insights.push("💀 Total wipe — enemy overwhelmed your army");
      if(playerDmg<enemyDmg*0.5)insights.push("📉 Low damage output — consider upgrading units");
      if(playerDeaths.length>0&&playerDeaths[0].t<5){
        const first=playerDeaths[0];
        insights.push(`⚡ ${first.n} died early (t=${first.t.toFixed(1)}s) — needs protection`);
      }
    }
    // Unit performance breakdown.
    const topPerformer=playerUnits.filter(u=>(u.dmgDealt||0)>0).sort((a,b)=>(b.dmgDealt||0)-(a.dmgDealt||0))[0];
    if(topPerformer)insights.push(`🌟 Top performer: ${topPerformer.n} (${Math.round(topPerformer.dmgDealt)} dmg)`);
    const underperformer=playerUnits.filter(u=>(u.dmgDealt||0)===0&&u.h<=0).sort((a,b)=>(a.h||0)-(b.h||0))[0];
    if(underperformer&&!win)insights.push(`⚠️ ${underperformer.n} dealt no damage before dying`);
    // Recommendations.
    const recs=[];
    const roles={};
    for(const u of this.loadoutUnits())if(u.role)roles[u.role]=(roles[u.role]||0)+1;
    if(!roles["frontline"])recs.push("Add a frontline unit to absorb damage");
    if(!roles["support"])recs.push("Add a support unit for healing");
    if(!roles["carry"])recs.push("Add a ranged carry for DPS");
    if(!roles["counter"])recs.push("Add a counter unit to dive enemy carries");
    // Render insights.
    if(insights.length){
      html+="<div style='margin:8px 0;'>";
      for(const i of insights)html+=`<div style='font-size:.72rem;margin:3px 0;color:var(--text);'>${i}</div>`;
      html+="</div>";
    }
    // Render recommendations.
    if(recs.length){
      html+="<div style='margin-top:8px;padding-top:8px;border-top:1px solid var(--border);'>";
      html+="<div style='font-size:.72rem;font-weight:700;color:var(--accent2);margin-bottom:4px;'>📋 Recommendations:</div>";
      for(const r of recs)html+=`<div style='font-size:.7rem;margin:2px 0;color:var(--muted);'>• ${r}</div>`;
      html+="</div>";
    }
    el.innerHTML=html;
  },

  // Render battle highlights on the result screen.
  _renderMatchHighlights(win){
    const el=$("matchHighlights");
    if(!el)return;
    const playerTeam=connected&&role==="guest"?"enemy":"player";
    const _finalUnits=Battle._finalUnits||Battle.units||[];
    const playerUnits=_finalUnits.filter(u=>u.team===playerTeam);
    if(playerUnits.length===0){el.style.display="none";return;}
    el.style.display="block";
    let html="<div style='font-weight:700;font-size:.85rem;margin-bottom:8px;text-align:center;'>🌟 Battle Highlights</div>";
    const highlights=[];
    // Biggest hit.
    const h=Battle._highlights;
    if(h&&h.biggestHit>0&&h.biggestHitBy){
      highlights.push(`💥 <b>${h.biggestHitBy}</b> dealt <b style="color:var(--warn)">${Math.round(h.biggestHit)}</b> damage${h.biggestHitCrit?" (CRIT!)":""} to ${h.biggestHitTarget}`);
    }
    // Top performer (most damage).
    const topDmg=playerUnits.filter(u=>(u.dmgDealt||0)>0).sort((a,b)=>(b.dmgDealt||0)-(a.dmgDealt||0))[0];
    if(topDmg){
      highlights.push(`🏆 <b>${topDmg.n}</b> was MVP with <b style="color:var(--accent2)">${Math.round(topDmg.dmgDealt)}</b> damage and <b>${topDmg.kills||0}</b> kills`);
    }
    // Longest survivor (last to die or still alive).
    const sortedByDeath=playerUnits.filter(u=>u.deathT!==undefined||u.h>0).sort((a,b)=>{
      const aTime=a.h>0?Battle.time:(a._deathTime||0);
      const bTime=b.h>0?Battle.time:(b._deathTime||0);
      return bTime-aTime;
    });
    const longestSurvivor=sortedByDeath[0];
    if(longestSurvivor){
      const survived=longestSurvivor.h>0;
      highlights.push(`${survived?"🛡️":"⏱️"} <b>${longestSurvivor.n}</b> ${survived?"survived the entire battle":"lasted the longest"}`);
    }
    // Most kills.
    const topKiller=playerUnits.filter(u=>(u.kills||0)>0).sort((a,b)=>(b.kills||0)-(a.kills||0))[0];
    if(topKiller&&topKiller.kills>0){
      highlights.push(`⚔️ <b>${topKiller.n}</b> got <b style="color:var(--warn)">${topKiller.kills}</b> kills`);
    }
    // Comeback highlight (won after losing early).
    if(win&&Match.history.length>=2&&Match.history[0].winner==="enemy"){
      highlights.push("🔥 <b>Comeback victory</b> — won after losing the first round!");
    }
    // Domination (won without losing a round).
    if(win&&Match.history.length>0&&Match.history.every(r=>r.winner==="player")){
      highlights.push("💪 <b>Flawless victory</b> — won every round!");
    }
    // Render highlights.
    if(highlights.length>0){
      html+="<div style='display:flex;flex-direction:column;gap:4px;'>";
      for(const hl of highlights){
        html+=`<div style='font-size:.72rem;color:var(--text);padding:4px 8px;background:var(--bg);border-radius:var(--radius-sm);'>${hl}</div>`;
      }
      html+="</div>";
    }else{
      html+="<div style='text-align:center;color:var(--muted);font-size:.72rem;'>No highlights this match.</div>";
    }
    el.innerHTML=html;
  },

  // Render unit performance ranking on the result screen.
  _renderMatchPerformance(win){
    const el=$("matchPerformance");
    if(!el)return;
    const playerTeam=connected&&role==="guest"?"enemy":"player";
    const _finalUnits=Battle._finalUnits||Battle.units||[];
    const playerUnits=_finalUnits.filter(u=>u.team===playerTeam);
    if(playerUnits.length===0){el.style.display="none";return;}
    el.style.display="block";
    // Score each unit: damage + kills*50 + survival bonus.
    const scored=playerUnits.map(u=>{
      const dmg=u.dmgDealt||0;
      const kills=u.kills||0;
      const survived=u.h>0;
      const score=Math.round(dmg+kills*50+(survived?30:0));
      return {u,score,dmg,kills,survived};
    }).sort((a,b)=>b.score-a.score);
    let html="<div style='font-weight:700;font-size:.85rem;margin-bottom:8px;text-align:center;'>📊 Unit Performance</div>";
    // Best performer.
    if(scored.length>0&&scored[0].score>0){
      const best=scored[0];
      html+=`<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:var(--radius-sm);margin:4px 0;">`+
        `<div style="font-size:1.2rem;">🏆</div>`+
        `<div style="flex:1;"><div style="font-weight:700;color:${best.u.c};font-size:.8rem;">${best.u.n}</div>`+
        `<div style="font-size:.65rem;color:var(--muted);">${Math.round(best.dmg)} dmg · ${best.kills} kills${best.survived?" · survived":""}</div></div>`+
        `<div style="font-weight:700;color:var(--ok);font-size:.85rem;">${best.score}</div></div>`;
    }
    // Worst performer (if more than 1 unit).
    if(scored.length>1){
      const worst=scored[scored.length-1];
      if(worst.score<scored[0].score){
        html+=`<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:var(--radius-sm);margin:4px 0;opacity:0.7;">`+
          `<div style="font-size:1.2rem;">💤</div>`+
          `<div style="flex:1;"><div style="font-weight:700;color:${worst.u.c};font-size:.8rem;">${worst.u.n}</div>`+
          `<div style="font-size:.65rem;color:var(--muted);">${Math.round(worst.dmg)} dmg · ${worst.kills} kills${worst.survived?"":" · fell"}</div></div>`+
          `<div style="font-weight:700;color:var(--warn);font-size:.85rem;">${worst.score}</div></div>`;
      }
    }
    // All units bar chart.
    html+="<div style='margin:8px 0 4px;font-size:.7rem;color:var(--muted);text-align:center;'>All units:</div>";
    const maxScore=Math.max(1,...scored.map(s=>s.score));
    html+="<div style='display:flex;flex-direction:column;gap:3px;'>";
    for(const s of scored){
      const pct=Math.round(s.score/maxScore*100);
      const barColor=s.score>maxScore*0.6?"var(--ok)":s.score>maxScore*0.3?"var(--warn)":"#fb7185";
      html+=`<div style="display:flex;align-items:center;gap:6px;font-size:.65rem;">`+
        `<span style="min-width:60px;color:${s.u.c};font-weight:700;">${s.u.n}</span>`+
        `<div style="flex:1;height:10px;background:var(--bg);border-radius:5px;overflow:hidden;">`+
        `<div style="width:${pct}%;height:100%;background:${barColor};border-radius:5px;transition:width .3s;"></div></div>`+
        `<span style="min-width:30px;text-align:right;color:var(--muted);">${s.score}</span></div>`;
    }
    html+="</div>";
    el.innerHTML=html;
  },

  // Phase 6/8: achievement definitions + unlock checks.
  achievements:{
    firstWin:{name:"First Victory",desc:"Win your first match",check:G=>G.save.matchWins>=1,progress:G=>`${Math.min(G.save.matchWins||0,1)}/1`},
    win10:{name:"Veteran",desc:"Win 10 matches",check:G=>G.save.matchWins>=10,progress:G=>`${Math.min(G.save.matchWins||0,10)}/10`},
    win25:{name:"Champion",desc:"Win 25 matches",check:G=>G.save.matchWins>=25,progress:G=>`${Math.min(G.save.matchWins||0,25)}/25`},
    level5:{name:"Rising Hero",desc:"Reach player level 5",check:G=>G.playerLevel()>=5,progress:G=>`${Math.min(G.playerLevel(),5)}/5`},
    level10:{name:"Legendary",desc:"Reach player level 10",check:G=>G.playerLevel()>=10,progress:G=>`${Math.min(G.playerLevel(),10)}/10`},
    rich:{name:"Coin Hoarder",desc:"Hold 100 coins",check:G=>(G.save.coins||0)>=100,progress:G=>`${Math.min(G.save.coins||0,100)}/100`},
    rich500:{name:"Tycoon",desc:"Hold 500 coins",check:G=>(G.save.coins||0)>=500,progress:G=>`${Math.min(G.save.coins||0,500)}/500`},
    comeback:{name:"Comeback King",desc:"Win after losing round 1",check:G=>G._comebackCheck(),progress:G=>G._comebackCheck()?"1/1":"0/1"},
    arenaMaster:{name:"Arena Master",desc:"Unlock all arenas",check:G=>(G.save.arena||0)>=G.arenas.length-1,progress:G=>`${Math.min(G.save.arena||0,G.arenas.length-1)}/${G.arenas.length-1}`},
    roleMaster:{name:"Role Master",desc:"Win with each role as last standing",check:G=>G._roleMasterCheck(),progress:G=>{const w=G.save.roleWins||{};const n=["frontline","carry","counter","support","utility"].filter(r=>w[r]>0).length;return `${n}/5`}},
    firstForge:{name:"First Forge",desc:"Create your first custom unit",check:G=>(G.save.collection||[]).some(u=>u.recipe&&!G.base.find(b=>b.n===u.n)),progress:G=>{const n=(G.save.collection||[]).filter(u=>u.recipe&&!G.base.find(b=>b.n===u.n)).length;return `${Math.min(n,1)}/1`}},
    fullCustom:{name:"Full Custom",desc:"Win with a 4-card custom-only loadout",check:G=>G._fullCustomCheck(),progress:G=>G._fullCustomCheck()?"1/1":"0/1"},
    streak3:{name:"On Fire",desc:"Win 3 matches in a row",check:G=>(G.save.bestStreak||0)>=3,progress:G=>`${Math.min(G.save.bestStreak||0,3)}/3`},
    streak5:{name:"Unstoppable",desc:"Win 5 matches in a row",check:G=>(G.save.bestStreak||0)>=5,progress:G=>`${Math.min(G.save.bestStreak||0,5)}/5`},
    streak10:{name:"Juggernaut",desc:"Win 10 matches in a row",check:G=>(G.save.bestStreak||0)>=10,progress:G=>`${Math.min(G.save.bestStreak||0,10)}/10`},
    endless5:{name:"Endless Warrior",desc:"Reach endless level 5",check:G=>(G.save.endlessLevel||0)>=5,progress:G=>`${Math.min(G.save.endlessLevel||0,5)}/5`},
    endless10:{name:"Endless Legend",desc:"Reach endless level 10",check:G=>(G.save.endlessLevel||0)>=10,progress:G=>`${Math.min(G.save.endlessLevel||0,10)}/10`},
    hardWin:{name:"Hard Mode Hero",desc:"Win a match on Hard difficulty",check:G=>G._hardWinCheck(),progress:G=>G._hardWinCheck()?"1/1":"0/1"},
    collector:{name:"Collector",desc:"Collect 20 unique units",check:G=>G.collectionUnits().length>=20,progress:G=>`${Math.min(G.collectionUnits().length,20)}/20`},
    collector50:{name:"Master Collector",desc:"Collect 50 unique units",check:G=>G.collectionUnits().length>=50,progress:G=>`${Math.min(G.collectionUnits().length,50)}/50`},
    damageDealer:{name:"Damage Dealer",desc:"Deal 10,000 total damage",check:G=>(G.save.stats?.totalDmg||0)>=10000,progress:G=>`${Math.min(Math.round(G.save.stats?.totalDmg||0),10000).toLocaleString()}/10,000`},
    exterminator:{name:"Exterminator",desc:"Get 100 total kills",check:G=>(G.save.stats?.totalKills||0)>=100,progress:G=>`${Math.min(G.save.stats?.totalKills||0,100)}/100`},
    spellmaster:{name:"Spellmaster",desc:"Cast 50 spells",check:G=>(G.save.stats?.totalSpells||0)>=50,progress:G=>`${Math.min(G.save.stats?.totalSpells||0,50)}/50`}
  },
  _hardWinCheck(){
    // Check if the player won the most recent match on hard difficulty.
    return (G.save.difficulty==="hard")&&(G.save._lastMatchWon===true);
  },
  _roleMasterCheck(){
    // Check if the player has won matches with each role as the last unit standing.
    // assassin→counter and bruiser→frontline mapping done at tracking time.
    const wins=(G.save.roleWins||{});
    return ["frontline","carry","counter","support","utility"].every(r=>wins[r]>0);
  },
  _fullCustomCheck(){
    // Win a match where all 4 loadout units are custom (not starter roster).
    // Uses the loadout from the last won match, not the current loadout.
    const loadout=G.save._lastWinLoadout||G.save.loadout||[];
    if(loadout.length<4)return false;
    // All 4 must be non-starter (not in G.base).
    return loadout.every(name=>!G.base.find(b=>b.n===name));
  },
  _comebackCheck(){
    // Check if the player won the match after losing round 1.
    return Match.history.length>=2&&Match.history[0].winner==="enemy"&&
      Match.livesPlayer>0&&Match.livesEnemy<=0;
  },
  checkAchievements(){
    const a=this.save.achievements||{};
    const achDefs=this.achievements||{};
    let unlocked=false;
    for(const key in achDefs){
      if(!a[key]){
        try{
          if(achDefs[key]&&typeof achDefs[key].check==="function"&&achDefs[key].check(this)){
            a[key]=true;
            toast("🏆 "+achDefs[key].name+" unlocked!");
            unlocked=true;
          }
        }catch(e){/* ignore single achievement check failure */}
      }
    }
    if(unlocked)GameAudio.sfx("achievement");
    saveData(this.save);
  },

  // Phase 5: battle control. Host/solo drive Battle directly; guest forwards
  // commands to the host (authoritative simulation).
  // DET: in lockstep mode, the sim runs automatically via loop() on both peers.
  // Manual tick/auto/skip would advance only the local sim → desync. Disable them.
  tick(){
    if(Battle._lockstepActive)return; // DET: no manual tick in lockstep
    // RELAY: guest in relay mode forwards commands to host (same as non-lockstep P2P).
    if(connected&&role==="guest"){transmit("cmd",{cmd:"tick"});return;}
    Battle.tick();
  },
  auto(){
    // DET: no auto-play in lockstep — sim runs via loop() on both peers.
    if(Battle._lockstepActive)return;
    // RELAY: guest in relay mode uses the same cmd path as non-lockstep P2P.
    // Toggle auto-play button state (for both host/solo and guest).
    const btn=$("autoBtn");
    if(Battle.autoTimer||this._guestAutoActive){
      // Stop auto-play.
      if(Battle.autoTimer){clearInterval(Battle.autoTimer);Battle.autoTimer=null;}
      this._guestAutoActive=false;
      if(btn)btn.classList.remove("primary");
      if(connected&&role==="guest"){transmit("cmd",{cmd:"auto_stop"});return;}
    }else{
      // Start auto-play.
      if(connected&&role==="guest"){
        this._guestAutoActive=true;
        if(btn)btn.classList.add("primary");
        transmit("cmd",{cmd:"auto"});
        return;
      }
      Battle.auto();
      if(btn)btn.classList.add("primary");
    }
  },
  skip(){
    // DET: no skip in lockstep — would advance only local sim → desync.
    if(Battle._lockstepActive)return;
    if(connected&&role==="guest"){transmit("cmd",{cmd:"skip"});return;}
    Battle.skip();
  },
  cycleSpeed(){
    // RELAY: guest in relay mode sends simple cmd (host applies, no tick scheduling).
    if(connected&&role==="guest"&&Battle._useRelay){
      transmit("cmd",{cmd:"speed"});
      // Update local UI — actual speed change arrives via snapshot.
      const newSpeed=Battle.speed===1?2:Battle.speed===2?4:1;
      const btn=$("speedBtn");if(btn)btn.textContent=newSpeed+"×";
      return;
    }
    // DET: in lockstep, speed changes must apply on both peers at the same tick.
    if(connected&&Battle._lockstepActive){
      const newSpeed=Battle.speed===1?2:Battle.speed===2?4:1;
      const targetTick=(Battle._tick||0)+3;
      const cmd={type:"speed",speed:newSpeed,tick:targetTick};
      Battle.queueCommand(cmd,targetTick);
      if(connected)_transmitSignedCmd(cmd);
      // Update local UI immediately (sim speed changes at the scheduled tick).
      Battle.speed=newSpeed;Battle._manualSpeed=true;
      const btn=$("speedBtn");if(btn)btn.textContent=newSpeed+"×";
      this.save.defaultSpeed=newSpeed;saveData(this.save);
      if(Battle.autoTimer)Battle.auto();
      return;
    }
    if(connected&&role==="guest"){transmit("cmd",{cmd:"speed"});return;}
    Battle.speed=Battle.speed===1?2:Battle.speed===2?4:1;
    Battle._manualSpeed=true; // user override — disable dramatic slowdown
    const btn=$("speedBtn");
    if(btn)btn.textContent=Battle.speed+"×";
    // Save preferred speed.
    this.save.defaultSpeed=Battle.speed;
    saveData(this.save);
    // Restart auto timer with new speed if running.
    if(Battle.autoTimer)Battle.auto();
  },
  togglePause(){
    // RELAY: guest in relay mode sends simple cmd (host applies, no tick scheduling).
    if(connected&&role==="guest"&&Battle._useRelay){
      transmit("cmd",{cmd:"pause"});
      // Update local UI — actual pause state arrives via snapshot.
      const nowPaused=!Battle.paused;
      const btn=$("pauseBtn");if(btn)btn.textContent=nowPaused?"▶":"⏸";
      Battle.paused=nowPaused; // local preview
      return;
    }
    // DET: in lockstep, pause/resume must apply on both peers at the same tick.
    if(connected&&Battle._lockstepActive){
      const nowPaused=!Battle.paused;
      const targetTick=(Battle._tick||0)+3;
      const cmd={type:nowPaused?"pause":"resume",tick:targetTick};
      Battle.queueCommand(cmd,targetTick);
      if(connected)_transmitSignedCmd(cmd);
      // Update local UI immediately.
      Battle.paused=nowPaused;
      const btn=$("pauseBtn");if(btn)btn.textContent=nowPaused?"▶":"⏸";
      return;
    }
    if(connected&&role==="guest"){transmit("cmd",{cmd:"pause"});return;}
    Battle.togglePause();
  },

  // Phase 5/10: guest applies a host snapshot and renders it (no local sim).
  // J3: Interpolates between previous and current snapshot for smooth rendering.
  applyRemoteSnapshot(snap){
    if(!snap||typeof snap!=="object")return;
    // P2P security: validate snapshot structure.
    if(!Array.isArray(snap.units))return;
    // PERF-R12: clear sprite cache when guest enters a new battle (units were empty).
    if(Battle.units.length===0&&snap.units.length>0)_clearSpriteCache();
    // Cap units to prevent memory exhaustion (max 200 units per side).
    if(snap.units.length>400)return;
    // Validate each unit has required numeric fields.
    // PERF-R13: index loop (avoid for...of iterator allocation at 20Hz).
    for(let vui=0;vui<snap.units.length;vui++){
      const u=snap.units[vui];
      if(!u||typeof u.x!=="number"||typeof u.y!=="number"||typeof u.h!=="number")return;
      // Clamp coordinates to game space.
      if(u.x<-1000||u.x>1000||u.y<-1000||u.y>1000)return;
      // P2P security: validate team value.
      const team=u.t||u.team;
      if(team!=="player"&&team!=="enemy")return;
    }
    // Validate projectiles if present.
    if(snap.projectiles&&!Array.isArray(snap.projectiles))snap.projectiles=[];
    if(snap.recentCrits&&!Array.isArray(snap.recentCrits))snap.recentCrits=[];
    // J3: Handle compressed snapshots (units have short keys).
    // PERF-R13: reuse pooled objects for decompression (avoid N allocations at 20Hz).
    if(snap.units[0]&&snap.units[0].i!==undefined){
      if(!Battle._decompPool)Battle._decompPool=[];
      if(!Battle._decompProjPool)Battle._decompProjPool=[];
      const dp=Battle._decompPool;
      const dpp=Battle._decompProjPool;
      const ulen=snap.units.length;
      for(let i=0;i<ulen;i++){
        if(i>=dp.length)dp[i]={};
        const u=snap.units[i],o=dp[i];
        o.id=u.i;o.n=u.n;o.x=u.x;o.y=u.y;o.h=u.h;o.mh=u.mh;o.team=u.t;
        o.animState=u.s;o.c=u.c;o.z=u.z;o.r=u.r;
        o.prevH=u.h;o.deathT=u.h<=0?0:undefined;
      }
      dp.length=ulen;
      const plen=(snap.projectiles||[]).length;
      for(let i=0;i<plen;i++){
        if(i>=dpp.length)dpp[i]={};
        const p=snap.projectiles[i],o=dpp[i];
        o.x=p.x;o.y=p.y;o.tx=p.tx;o.ty=p.ty;o.c=p.c;o.d=p.d;o.team=p.t;o.dead=false;o.life=1;
      }
      dpp.length=plen;
      snap={units:dp,projectiles:dpp,recentCrits:snap.rc||[],time:snap.time,winner:snap.winner};
    }
    // Guard: filter out any null/undefined units or units missing x/y.
    // NETFIX: filter in-place to avoid spread allocation (was {...snap,units:...}).
    let validUnits=snap.units;
    let hasInvalid=false;
    for(let i=0;i<validUnits.length;i++){
      if(!validUnits[i]||validUnits[i].x===undefined||validUnits[i].y===undefined){hasInvalid=true;break;}
    }
    if(hasInvalid){
      validUnits=validUnits.filter(u=>u&&u.x!==undefined&&u.y!==undefined);
      snap.units=validUnits;
    }
    // J3: Store interpolation state — from = current units, to = new snapshot.
    // NETFIX: reuse pooled array for interpFrom units (avoids N allocations per snapshot).
    if(Battle.units.length>0&&snap.units.length>0){
      if(!Battle._interpFromPool)Battle._interpFromPool=[];
      const pool=Battle._interpFromPool;
      const poolLen=Math.min(Battle.units.length,pool.length);
      let pi=0;
      for(;pi<Battle.units.length;pi++){
        const u=Battle.units[pi];
        if(!pool[pi])pool[pi]={id:0,x:0,y:0,h:0};
        pool[pi].id=u.id;pool[pi].x=u.x;pool[pi].y=u.y;pool[pi].h=u.h;
      }
      pool.length=Battle.units.length;
      Battle._interpFrom={units:pool,time:Battle.time};
      // NETFIX: force fromMap rebuild in _interpRender — the pool array is
      // reused (same reference), so the _interpFromUnits!==check would skip
      // the rebuild, leaving the fromMap with stale positions.
      Battle._interpFromUnits=null;
      Battle._interpTo=snap;
      Battle._interpStart=performance.now();
      Battle._interpDur=0.1; // 100ms interpolation window
    }
    Battle.applySnapshot(snap);
    Battle.projectiles=snap.projectiles||[];
    Battle.time=snap.time||0;
    // NETFIX: only render immediately on first snapshot (no interp state yet).
    // On subsequent snapshots, the interp loop handles rendering — calling
    // renderOnly() here would render the NEW positions without interpolation,
    // causing a 1-frame visual "snap" before the interp loop kicks in.
    if(!Battle._interpFrom)Battle.renderOnly();
    // J3: Start interpolation render loop for smooth guest rendering.
    if(Battle.running)Battle._startInterpLoop();
    // HUD: from the guest's perspective, "enemy" team is the guest's own army.
    // NETFIX: use count loops instead of filter() (was 2 filter allocations per snapshot).
    // NETFIX: throttle guest HUD to 10fps (matches SP path, was 20Hz).
    Battle._guestHudT=(Battle._guestHudT||0)+0.05; // 50ms per snapshot
    if(Battle._guestHudT>=0.1){
      Battle._guestHudT=0;
      let myAlive=0,hostAlive=0;
      for(let i=0;i<Battle.units.length;i++){
        const u=Battle.units[i];
        if(u.h>0){
          if(u.team==="enemy")myAlive++;
          else if(u.team==="player")hostAlive++;
        }
      }
      setText("battleHP",myAlive);
      setText("battleEnemy",hostAlive);
      setText("turn","T"+Math.floor(Battle.time));
    }
    // RELAY: sync spell cooldowns from host snapshot.
    if(snap.spellCDs&&Battle._allPlayerSpells){
      for(const team of ["player","enemy"]){
        const hostCDs=snap.spellCDs[team];
        const localSpells=Battle._allPlayerSpells[team];
        if(hostCDs&&localSpells){
          for(let i=0;i<hostCDs.length&&i<localSpells.length;i++){
            localSpells[i].cooldown=hostCDs[i].cd;
            localSpells[i]._pendingCast=hostCDs[i].pc;
          }
        }
      }
    }
    // RELAY: sync pause/speed state from host.
    if(typeof snap.paused==="boolean"){
      Battle.paused=snap.paused;
      const btn=$("pauseBtn");if(btn)btn.textContent=snap.paused?"▶":"⏸";
    }
    if(typeof snap.speed==="number"){
      Battle.speed=snap.speed;
      const btn=$("speedBtn");if(btn)btn.textContent=snap.speed+"×";
    }
    if(snap.winner){
      // Host's "player" = host won → guest lost. Host's "enemy" = guest won.
      const guestWinner=snap.winner==="enemy"?"player":(snap.winner==="player"?"enemy":"draw");
      Battle.running=false;
      this.onBattleEnd(guestWinner);
    }
  },

  // Phase 12: forge screen — show prompt input + ad-gated generation.
  forge(){
    this.screen("forge");
    this.setForgeMode("unit"); // Default to Unit mode on screen entry.
    // I1: Start ambient forge music.
    GameAudio.init();GameAudio.stopMusic();GameAudio.startAmbient();
    const aiStatus=$("aiStatus");
    if(aiStatus)aiStatus.innerText=llmReady?"AI: Ready":llmLoading?"AI: Downloading model...":(navigator.gpu?"AI: Idle (will download on first forge)":"AI: Unavailable (templates)");
    const preview=$("forgePreview");
    if(preview)preview.innerHTML="";
    const actions=$("forgeActions");
    if(actions)actions.style.display="none";
    const btn=$("forgeGenBtn");
    if(btn)btn.style.display="inline-block";
    // Phase 12: show Skip button (template fallback without ad).
    const skipBtn=$("forgeSkipBtn");
    if(skipBtn)skipBtn.style.display="inline-block";
    // Show model download progress if the model is still loading in the
    // background (from preloadAI). This way the user sees the progress bar
    // immediately on entering the forge, not just after tapping "Generate".
    if(llmLoading&&!llmReady){
      this._showModelProgress();
    }else{
      this._hideModelProgress();
    }
    if(btn)btn.innerText="📺 Watch Ad to Generate";
  },

  // Phase 12: ad-gated forge — parallel ad + LLM generation.
  // Phase 12 (audit): confirmation prompt, model cache check, model download progress.
  pendingForgeUnit:null,
  _forgeConfirmOverlay:null,
  // Show "Watch Ad / Skip" confirmation prompt before starting the forge.
  // Phase 23: forge mode toggle (unit vs spell).
  forgeMode:"unit",
  setForgeMode(mode){
    this.forgeMode=mode;
    setText("forgeModeLabel",mode==="spell"?t("spell"):t("custom_unit"));
    const promptEl=$("forgePrompt");
    if(promptEl){
      promptEl.placeholder=mode==="spell"?"e.g. fireball, heal rain, frost nova...":"e.g. ice mage, fire dragon, ninja...";
      promptEl.setAttribute("aria-label",mode==="spell"?"Enter a concept for your custom spell":"Enter a concept for your custom unit");
    }
    const genBtn=$("forgeGenBtn");
    if(genBtn)genBtn.setAttribute("aria-label",mode==="spell"?"Watch an ad to generate a custom spell":"Watch an ad to generate a custom unit");
    const uBtn=$("forgeModeUnit"),sBtn=$("forgeModeSpell");
    if(uBtn){uBtn.style.opacity=mode==="unit"?"1":"0.5";uBtn.style.borderColor=mode==="unit"?"var(--accent)":"var(--border)";uBtn.style.boxShadow=mode==="unit"?"0 0 8px rgba(124,58,237,.4)":"none";}
    if(sBtn){sBtn.style.opacity=mode==="spell"?"1":"0.5";sBtn.style.borderColor=mode==="spell"?"var(--accent)":"var(--border)";sBtn.style.boxShadow=mode==="spell"?"0 0 8px rgba(124,58,237,.4)":"none";}
  },
  forgeWithAd(){
    const promptEl=$("forgePrompt");
    const prompt=promptEl?promptEl.value.trim():"";
    if(!prompt){toast(t("enter_concept"));return;}
    // Phase 12: confirmation prompt with Watch Ad + Skip options.
    const overlay=document.createElement("div");
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;";
    overlay.innerHTML=`<div style="text-align:center;padding:20px;max-width:320px;">
      <div style="font-size:1.1rem;margin-bottom:15px;">Watch a short ad to forge a custom unit?</div>
      <button id="forgeAdYes" style="margin:5px;padding:10px 20px;font-size:1rem;cursor:pointer;background:#4a7;border:none;color:#fff;border-radius:6px;">📺 Watch Ad</button>
      <button id="forgeAdNo" style="margin:5px;padding:10px 20px;font-size:1rem;cursor:pointer;background:#444;border:none;color:#fff;border-radius:6px;">⏭ Skip</button>
    </div>`;
    document.body.appendChild(overlay);
    this._forgeConfirmOverlay=overlay;
    overlay.querySelector("#forgeAdYes").onclick=()=>{overlay.remove();this._doForge(prompt,true);};
    overlay.querySelector("#forgeAdNo").onclick=()=>{overlay.remove();this._doForge(prompt,false);};
  },
  // Skip ad entirely — use template fallback only (no LLM wait).
  forgeSkipAd(){
    const promptEl=$("forgePrompt");
    const prompt=promptEl?promptEl.value.trim():"";
    if(!prompt){toast(t("enter_concept"));return;}
    this._doForge(prompt,false);
  },
  // Core forge logic — runs ad (if watchAd) + generation in parallel.
  // Phase 23: supports spell forge mode.
  // Upgraded: LLM preloaded at app start, ad is 1s, skip uses template, heavy debug logging.
  async _doForge(prompt,watchAd){
    if(this._forgeRunning)return;
    // Daily forge cap: max 10 forges per day.
    const today=Quests.todayStr();
    if(this.save.forgeDate!==today){this.save.forgeDate=today;this.save.forgeCount=0;}
    if((this.save.forgeCount||0)>=10){toast("Daily forge limit reached (10/day). Come back tomorrow!");return;}
    this.save.forgeCount=(this.save.forgeCount||0)+1;
    saveDataDebounced(this.save);
    this._forgeRunning=true;
    GameAudio.sfx("forge_whoosh"); // Phase 30
    const btn=$("forgeGenBtn");
    const skipBtn=$("forgeSkipBtn");
    if(btn)btn.style.display="none";
    if(skipBtn)skipBtn.style.display="none";
    const preview=$("forgePreview");
    if(preview)preview.innerHTML='<div class="detail">Generating...</div>';
    const arenaIdx=this.save.arena||0;
    const canUseLLM=navigator.gpu&&W&&(W.CreateMLCEngine||W.CreateWebWorkerMLCEngine);
    debugForge("_doForge start",{prompt,watchAd,forgeMode:this.forgeMode,canUseLLM,llmReady,llmLoading});
    // Phase 23: spell forge path.
    if(this.forgeMode==="spell"){
      try{
        const adPromise=watchAd?new Promise(res=>AdSDK.showRewarded(FORGE_AD_MS,res)):Promise.resolve();
        let genPromise;
        if(watchAd && canUseLLM){
          if(llmLoading&&!llmReady)this._showModelProgress();
          // Set up generation progress callback for spell fields.
          forgeGenProgress=(current,total,field)=>{
            const pct=Math.round((current/total)*100);
            updateAI(`Crafting your spell... (${current+1}/${total}: ${FIELD_LABELS[field]||field})`,pct);
            const prog=$("forgeModelProgress");
            if(prog&&prog.style.display==="none")prog.style.display="block";
          };
          genPromise=generateSpell(prompt,arenaIdx);
        }else{
          debugForge("spell using template fallback",{watchAd,canUseLLM});
          genPromise=Promise.resolve({...templateSpellFallback(prompt),_isSpell:true});
        }
        await adPromise;
        let spell;
        try{spell=await genPromise;}catch(e){
          debugForge("spell generation threw, using template:",e.message);
          spell={...templateSpellFallback(prompt),_isSpell:true};
        }
        if(!spell)spell={...templateSpellFallback(prompt),_isSpell:true};
        forgeGenProgress=null;
        this._hideModelProgress();
        this.pendingForgeSpell=spell;
        this.showSpellForgePreview(spell);
        GameAudio.sfx("forge_reveal");
        debugForge("_doForge result",{spell,forgeMode:this.forgeMode});
      }catch(e){
        console.error("Spell forge failed:",e);
        forgeGenProgress=null;
        this._hideModelProgress();
        toast("Forge failed. Please try again.");
      }finally{
        this._forgeRunning=false;
      }
      return;
    }
    // Phase 12: unit forge path.
    try{
      const adPromise=watchAd?new Promise(res=>AdSDK.showRewarded(FORGE_AD_MS,res)):Promise.resolve();
      let genPromise;
      if(watchAd && canUseLLM){
        // Phase 12: if LLM is still loading, show model download progress + Cancel.
        if(llmLoading&&!llmReady){
          this._showModelProgress();
        }
        // Set up generation progress callback — reuses the forgeModelProgress bar.
        forgeGenProgress=(current,total,field)=>{
          const pct=Math.round((current/total)*100);
          updateAI(`Designing your unit... (${current+1}/${total}: ${FIELD_LABELS[field]||field})`,pct);
          const prog=$("forgeModelProgress");
          if(prog&&prog.style.display==="none")prog.style.display="block";
        };
        genPromise=generateUnit(prompt,arenaIdx);
      }else{
        // No LLM / skip ad — use template fallback directly.
        debugForge("unit using template fallback",{watchAd,canUseLLM});
        genPromise=Promise.resolve(attrsToUnit(templateFallback(prompt),arenaIdx));
      }
      await adPromise;
      let unit;
      try{unit=await genPromise;}
      catch(e){
        debugForge("unit generation threw, using template:",e.message);
        unit=attrsToUnit(templateFallback(prompt),arenaIdx);
      }
      if(!unit){
        unit=attrsToUnit(templateFallback(prompt),arenaIdx);
      }
      forgeGenProgress=null;
      this._hideModelProgress();
      this.pendingForgeUnit=unit;
      this.showForgePreview(unit);
      GameAudio.sfx("forge_reveal"); // Phase 30
      debugForge("_doForge result",{unit,forgeMode:this.forgeMode});
    }catch(e){
      console.error("Forge failed:",e);
      forgeGenProgress=null;
      this._hideModelProgress();
      toast("Forge failed. Please try again.");
    }finally{
      this._forgeRunning=false;
    }
  },
  // Phase 23: show spell forge preview with effect description + add button.
  showSpellForgePreview(spell){
    const preview=$("forgePreview");
    if(!preview)return;
    const effectDesc=spell.effect.replace(/_/g," ");
    const triggerDesc=spell.trigger.replace(/_/g," ");
    const targetDesc=spell.target.replace(/_/g," ");
    preview.innerHTML=
      `<div class="card rar-rare" style="border-color:#fa4;max-width:280px;margin:0 auto;">`+
      `<div class="rarityTag rare">SPELL</div>`+
      `<div class="title" style="color:#fa4">✨ ${spell.name}</div>`+
      `<div class="detail">${effectDesc} · ${targetDesc}<br>${triggerDesc} · ${spell.fxType}<br>Magnitude: ${spell.magnitude} · Radius: ${spell.radius} · Duration: ${spell.duration}s</div>`+
      `</div>`+
      `<button class="btn primary" onclick="G.addSpellToBook()" style="margin-top:10px;">➕ Add to Spellbook</button>`;
    const genBtn=$("forgeGenBtn");
    if(genBtn)genBtn.style.display="inline-block";
  },
  // Phase 23: add forged spell to spellbook.
  addSpellToBook(){
    if(!this.pendingForgeSpell)return;
    if(!this.save.spellbook)this.save.spellbook=[];
    const spell=this.pendingForgeSpell;
    // Safety: ensure required fields have valid values.
    if(!SPELL_ENUM.trigger.includes(spell.trigger))spell.trigger="battle_start";
    if(!SPELL_ENUM.effect.includes(spell.effect))spell.effect="damage";
    if(!SPELL_ENUM.shape.includes(spell.shape))spell.shape="circle_aoe";
    if(!SPELL_ENUM.fxType.includes(spell.fxType))spell.fxType="explosion";
    if(!SPELL_ENUM.target.includes(spell.target))spell.target="enemy_cluster";
    // Clamp numeric values to valid ranges.
    spell.magnitude=clamp(Number(spell.magnitude)||30,1,200);
    spell.radius=clamp(Number(spell.radius)||60,10,200);
    spell.duration=clamp(Number(spell.duration)||0,0,10);
    this.save.spellbook.push(spell);
    // Cap spellbook at 20 to prevent save bloat.
    if(this.save.spellbook.length>20)this.save.spellbook=this.save.spellbook.slice(-20);
    saveData(this.save);
    toast(t("spell_added_book"));
    this.pendingForgeSpell=null;
    const preview=$("forgePreview");
    if(preview)preview.innerHTML="";
    const btn=$("forgeGenBtn");
    if(btn)btn.style.display="inline-block";
  },
  // Phase 12: show model download progress bar + Cancel button while LLM loads.
  _showModelProgress(){
    const prog=$("forgeModelProgress");
    if(prog)prog.style.display="block";
    const cancelBtn=$("forgeModelCancelBtn");
    if(cancelBtn)cancelBtn.style.display="inline-block";
    // updateAI() drives forgeModelFill/forgeModelText directly; this poller
    // just hides the panel once loading ends (ready, failed, or cancelled).
    if(this._modelPoll)clearInterval(this._modelPoll);
    this._modelPoll=setInterval(()=>{
      if(!llmLoading){
        clearInterval(this._modelPoll);this._modelPoll=null;
        // Keep the panel visible briefly if ready so the user sees "AI READY",
        // but hide the cancel button once there's nothing to cancel.
        if(cancelBtn)cancelBtn.style.display="none";
        if(!llmReady)this._hideModelProgress();
      }
    },200);
  },
  _hideModelProgress(){
    if(this._modelPoll){clearInterval(this._modelPoll);this._modelPoll=null;}
    const prog=$("forgeModelProgress");
    if(prog)prog.style.display="none";
  },

  // Phase 12: show the generated unit preview with keep/reroll buttons.
  showForgePreview(u){
    const preview=$("forgePreview");
    if(!preview||!u)return;
    const abLabel=u.ability&&u.ability!=="none"?`<br><span style="color:var(--accent2);font-weight:600;">${u.ability}</span>`:"";
    const roleLabel=u.role?`<br><span style="color:var(--muted)">${u.role}</span>`:"";
    const abDesc=u.ability&&u.ability!=="none"&&ABILITY_DESCRIPTIONS[u.ability]?`<div style="margin-top:6px;padding:6px 8px;background:rgba(124,58,237,.1);border:1px solid var(--border);border-radius:6px;font-size:.62rem;color:var(--accent2);line-height:1.3;">${ABILITY_DESCRIPTIONS[u.ability]}</div>`:"";
    const moveDesc=u.movement?`<span style="color:var(--muted)">${u.movement}</span>`:"";
    const targetDesc=u.targeting?` · <span style="color:var(--muted)">${u.targeting.replace(/_/g," ")}</span>`:"";
    preview.innerHTML=`<div class="card" style="border-color:var(--legendary);box-shadow:0 0 20px rgba(251,191,36,.2),var(--shadow-lg);max-width:240px;margin:0 auto;">
      <div class="rarityTag ${u.rar}">${u.rar.toUpperCase()}</div>
      <canvas width="56" height="56" style="display:block;margin:4px auto;"></canvas>
      <div class="title" style="color:${u.c};font-size:.9rem;">${u.n}</div>
      <div class="detail" style="margin-top:4px;">${u.h} HP · ${u.d} DMG<br>R${u.r} · ⚡${u.s}${abLabel}${roleLabel}</div>
      <div class="detail" style="margin-top:4px;font-size:.6rem;">${moveDesc}${targetDesc}</div>
      ${abDesc}
    </div>`;
    SpriteRenderer.renderPreview(preview.querySelector("canvas"),u);
    const actions=$("forgeActions");
    if(actions)actions.style.display="flex";
    // Phase 37: show share button.
    const shareBtn=$("shareUnitBtn");
    if(shareBtn)shareBtn.style.display="inline-block";
  },

  // Phase 12: keep the forged unit — add to collection.
  keepForge(){
    if(!this.pendingForgeUnit)return;
    this.addForge(this.pendingForgeUnit);
    this.pendingForgeUnit=null;
    saveData(this.save);
    toast(t("unit_added_collection"));
    Quests.track("forge"); // Phase 33
    this.menu();
  },
  // Phase 37: share the currently previewed forge unit.
  shareForgeUnit(){
    if(this.pendingForgeUnit)this.shareUnit(this.pendingForgeUnit);
  },

  // F2: Unit detail view — modal with full stats + animated preview.
  showUnitDetail(u){
    const overlay=document.createElement("div");
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;";
    const modal=document.createElement("div");
    modal.className="card";
    modal.style.cssText="background:linear-gradient(180deg,var(--card2),var(--card));border:1px solid var(--border);border-radius:var(--radius);padding:20px;max-width:300px;width:90%;text-align:center;box-shadow:var(--shadow-lg),var(--glow-accent);";
    const abDesc=ABILITY_DESCRIPTIONS[u.ability]||"";
    const abType=PASSIVE_ABILITIES.has(u.ability)?"Passive":TRIGGERED_ABILITIES.has(u.ability)?"Triggered":"";
    const lvl=this.unitLevel(u.n);
    const moveDesc=MOVEMENT_DESCRIPTIONS[u.movement]||"";
    const targetDesc=TARGETING_DESCRIPTIONS[u.targeting]||"";
    const triggerDesc=TRIGGER_DESCRIPTIONS[u.abilityTrigger]||"";
    const weaponDesc=WEAPON_DESCRIPTIONS[u.weaponType]||"";
    modal.innerHTML=
      `<canvas width="64" height="64" style="display:block;margin:4px auto;"></canvas>`+
      `<div class="title" style="color:${u.c};font-size:1rem;">${u.n}${lvl>0?` <span class="lvlBadge">Lv${lvl}</span>`:""}</div>`+
      `<div class="rarityTag ${u.rar}" style="margin:4px 0;">${u.rar.toUpperCase()}</div>`+
      `<div class="detail" style="text-align:left;margin:8px 0;font-size:.82rem;">`+
      `<b>HP:</b> ${u.h} · <b>DMG:</b> ${u.d}<br>`+
      `<b>Range:</b> ${u.r} · <b>Speed:</b> ${u.s}<br>`+
      `<b>Atk Spd:</b> ${u.a} · <b>Crit:</b> ${Math.round((u.crit||0)*100)}%<br>`+
      `<b>Role:</b> ${u.role||"—"}<br>`+
      `<b>Weapon:</b> ${u.weaponType||"none"}<br>`+
      `<span style="color:var(--muted);font-size:.74rem;">${weaponDesc}</span><br>`+
      `<b>Ability:</b> <span style="color:var(--accent2)">${u.ability}</span>${abType?` (${abType})`:""}<br>`+
      `<span style="color:var(--muted);font-size:.78rem;">${abDesc}</span>`+
      `</div>`+
      `<div class="detail" style="text-align:left;margin:8px 0;padding:8px;background:rgba(124,58,237,.08);border-radius:8px;font-size:.74rem;">`+
      `<b>Movement:</b> ${u.movement}<br><span style="color:var(--muted);font-size:.7rem;">${moveDesc}</span><br>`+
      `<b>Targeting:</b> ${u.targeting.replace(/_/g," ")}<br><span style="color:var(--muted);font-size:.7rem;">${targetDesc}</span><br>`+
      `<b>Trigger:</b> ${u.abilityTrigger.replace(/_/g," ")}<br><span style="color:var(--muted);font-size:.7rem;">${triggerDesc}</span>`+
      `</div>`;
    const closeBtn=document.createElement("button");
    closeBtn.className="btn";closeBtn.textContent="Close";closeBtn.style.cssText="margin-top:8px;";
    closeBtn.onclick=()=>overlay.remove();
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);document.body.appendChild(overlay);
    overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
    SpriteRenderer.renderPreview(modal.querySelector("canvas"),u);
  },

  addForge(u){
    // Phase 13: forged units go to collection.
    if(!this.save.collection)this.save.collection=[];
    this.save.collection.push(u);
    // Cap collection at 50 — but never remove units that are in the current loadout.
    while(this.save.collection.length>50){
      const loadout=new Set(this.save.loadout||[]);
      const idx=this.save.collection.findIndex(u=>!loadout.has(u.n));
      if(idx<0)break; // all units are in loadout — keep extra
      this.save.collection.splice(idx,1);
    }
    // Also keep ai for backward compat with network forge sharing.
    this.save.ai.push(u);
    if(this.save.ai.length>50)this.save.ai.shift();
    saveData(this.save);
    this.wins();
    transmit("forge",u);
  },

  next(){this.start();}, // Phase 8: starts a new match

  // Auto-fill loadout with the highest power-score units, prioritizing role diversity.
  autoFillLoadout(){
    const coll=this.collectionUnits();
    if(coll.length===0){toast("No units available");return;}
    // Score each unit (same formula as tier list).
    const scored=coll.map(u=>{
      const lvl=this.unitLevel(u.n);
      const hp=u.h*(1+0.1*lvl),dmg=u.d*(1+0.1*lvl);
      let score=hp*0.5+dmg*2+u.r*0.3+u.s*0.2+u.a*5+(u.crit||0)*20;
      const abBonus={none:0,splash:15,heal:20,dodge:25,poison:15,spawn:20,lifesteal:20,explode:15,heal_burst:20,shield:25,rage:20,slow:10,ramp:25,thorns:15,blink_strike:25,frenzy:20,regen:15,cleanse:15,taunt:20,executioner:25,chain_lightning:25};
      score+=abBonus[u.ability]||0;
      score+=u.rar==="legendary"?30:u.rar==="rare"?15:0;
      return {u,score};
    }).sort((a,b)=>b.score-a.score);
    // Pick top unit for each role, prioritizing frontline, carry, support, counter.
    const rolePriority=["frontline","carry","support","counter"];
    const picked=[];
    const usedNames=new Set();
    for(const role of rolePriority){
      const best=scored.find(s=>s.u.role===role&&!usedNames.has(s.u.n));
      if(best){picked.push(best.u.n);usedNames.add(best.u.n);}
    }
    // Fill remaining slots with highest-scored unused units.
    for(const s of scored){
      if(picked.length>=4)break;
      if(!usedNames.has(s.u.n)){picked.push(s.u.n);usedNames.add(s.u.n);}
    }
    this.save.loadout=picked.slice(0,4);
    // Fill remaining slots with highest-scored units, avoiding duplicates.
    while(this.save.loadout.length<4){
      const next=scored.find(s=>!this.save.loadout.includes(s.u.n));
      if(next)this.save.loadout.push(next.u.n);
      else this.save.loadout.push("Knight");
    }
    saveData(this.save);
    GameAudio.sfx("level_up");
    toast("⚡ Loadout auto-filled with best units!");
    this.deck();
  },
  // Save current loadout as a named preset.
  savePreset(){
    const name=prompt("Preset name (e.g. 'Aggressive', 'Tank'):");
    if(!name||!name.trim())return;
    if(!this.save.presets)this.save.presets={};
    const key=name.trim();
    if(this.save.presets[key]){showConfirm("Preset '"+esc(key)+"' already exists. Overwrite?",()=>{this.save.presets[key]=this.save.loadout.slice();saveData(this.save);GameAudio.sfx("ui_click");toast("Preset saved");});return;}
    this.save.presets[key]=this.save.loadout.slice();
    saveData(this.save);
    GameAudio.sfx("ui_click");
    toast("💾 Preset '"+esc(key)+"' saved!");
    this._renderPresetList();
  },
  // Load a preset — shows a list of saved presets to choose from.
  loadPreset(){
    this._renderPresetList(true);
  },
  _renderPresetList(showAll){
    const el=$("presetList");
    if(!el)return;
    const presets=this.save.presets||{};
    const keys=Object.keys(presets);
    if(keys.length===0){
      el.style.display=showAll?"block":"none";
      el.innerHTML="<div style='text-align:center;color:var(--muted);font-size:.75rem;'>No presets saved. Use 'Save Preset' to create one.</div>";
      return;
    }
    el.style.display="block";
    let html="<div style='font-size:.75rem;font-weight:700;margin-bottom:6px;'>Saved Presets:</div>";
    for(let i=0;i<keys.length;i++){
      const name=keys[i];
      const safeName=String(name).replace(/</g,"").replace(/>/g,"").replace(/"/g,"'");
      const raw=presets[name];
      // Handle both old format ({name,loadout}) and current format (array).
      const loadout=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.loadout)?raw.loadout:[]);
      const units=loadout.map(n=>this.collectionUnits().find(u=>u.n===n)).filter(Boolean);
      const names=units.map(u=>`<span style="color:${u.c}">${u.n}</span>`).join(", ");
      html+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin:3px 0;background:var(--bg);border-radius:var(--radius-sm);">`+
        `<div><span style="font-weight:700;font-size:.78rem;">${safeName}</span><br><span style="font-size:.65rem;">${names}</span></div>`+
        `<div style="display:flex;gap:4px;"><button class="btn primary" style="font-size:.65rem;padding:2px 8px;" onclick="G.applyPreset(${i})">Load</button>`+
        `<button class="btn red" style="font-size:.65rem;padding:2px 8px;" onclick="G.deletePreset(${i})">✕</button></div></div>`;
    }
    el.innerHTML=html;
  },
  applyPreset(idx){
    const presets=this.save.presets||{};
    const keys=Object.keys(presets);
    const name=keys[idx];
    if(name===undefined||!presets[name])return;
    // Handle both old format ({name,loadout}) and current format (array).
    const raw=presets[name];
    const loadout=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.loadout)?raw.loadout:[]);
    this.save.loadout=loadout.slice();
    saveData(this.save);
    GameAudio.sfx("ui_click");
    toast("📂 Loaded preset '"+String(name).replace(/</g,"").replace(/>/g,"")+"'");
    this.deck();
  },
  deletePreset(idx){
    if(!this.save.presets)return;
    const keys=Object.keys(this.save.presets);
    const name=keys[idx];
    if(name===undefined||!this.save.presets[name])return;
    delete this.save.presets[name];
    saveData(this.save);
    this._renderPresetList();
  },
  clearLoadout(){
    this.save.loadout=["Knight","Archer","Slash","Wizard"];
    saveData(this.save);
    this.deck();
    toast("Loadout reset to defaults");
  },

  // Phase 13/16: deck screen = 4 loadout slots + synergy meter + collection.
  // UX: three ways to swap units:
  //  1. Tap a loadout slot to select it (highlights), then tap a collection unit
  //  2. Tap a collection unit (no slot selected) → popup to pick which slot
  //  3. Drag a collection unit onto a loadout slot
  _selectedSlot:null, // index of currently selected loadout slot (0-3 or null)
  deck(){
    this.screen("deck");
    this._selectedSlot=null; // reset selection on entry
    this._renderPresetList();
    this._renderLoadout();
    this.renderSynergyMeter();
    this._renderCollection();
  },
  _renderLoadout(){
    const la=$("loadoutArea");
    if(!la)return;
    la.innerHTML="";
    this.save.loadout.forEach((name,i)=>{
      const u=this.collectionUnits().find(x=>x.n===name)||this.base[0];
      const lvl=this.unitLevel(u.n);
      const lvlBadge=lvl>0?`<span class="lvlBadge">Lv${lvl}</span>`:"";
      const disp=lvl>0?this.applyUpgrades(cloneUnit(u)):u;
      const abIcons={none:"",splash:"💥",heal:"💚",dodge:"💨",poison:"☠️",spawn:"✨",lifesteal:"🩸",explode:"💣",heal_burst:"💖",shield:"🛡️",rage:"😤",slow:"🐌",ramp:"📈",thorns:"🌵",blink_strike:"⚡",frenzy:"🔥",regen:"🌿",cleanse:"🧹",taunt:"📣",executioner:"🗡️",chain_lightning:"🌩️"};
      const abIcon=u.ability&&u.ability!=="none"?abIcons[u.ability]||"":"";
      const sel=this._selectedSlot===i;
      const card=document.createElement("div");
      card.className="card";
      card.style.borderColor=sel?"var(--accent2)":"var(--accent)";
      card.style.boxShadow=sel?"0 0 8px var(--accent2)":"none";
      card.style.cursor="pointer";
      card.draggable=true;
      card.dataset.slot=i;
      card.innerHTML=`<canvas width="40" height="40" style="display:block;margin:2px auto;"></canvas><div class="title" style="color:${u.c}">${u.n}${lvlBadge}</div><div class="detail">${disp.h} HP · ${disp.d} DMG${abIcon?`<br><span style="color:var(--accent2)">${abIcon} ${u.ability}</span>`:"<br><span style=\"color:var(--muted)\">no ability</span>"}<br><span style="color:${sel?"var(--accent2)":"var(--muted)"};font-weight:${sel?"bold":"normal"}">${sel?"★ SELECTED — tap a unit":"SLOT "+(i+1)+" — tap to select"}</span></div>`;
      SpriteRenderer.renderPreview(card.querySelector("canvas"),u);
      // Tap slot to select/deselect
      card.onclick=(e)=>{
        if(e.target.tagName==="BUTTON")return;
        this._selectedSlot=(this._selectedSlot===i)?null:i;
        this._renderLoadout();
      };
      // Drag: allow swapping loadout slots by dragging one onto another
      card.ondragstart=(e)=>{
        e.dataTransfer.setData("text/plain",JSON.stringify({type:"slot",from:i}));
        card.style.opacity="0.5";
      };
      card.ondragend=()=>{card.style.opacity="1";};
      card.ondragover=(e)=>{e.preventDefault();card.style.borderColor="var(--accent2)";};
      card.ondragleave=()=>{card.style.borderColor=sel?"var(--accent2)":"var(--accent)";};
      card.ondrop=(e)=>{
        e.preventDefault();
        card.style.borderColor=sel?"var(--accent2)":"var(--accent)";
        try{
          const data=JSON.parse(e.dataTransfer.getData("text/plain"));
          if(data.type==="slot"&&data.from!==i){
            // Swap two loadout slots
            const tmp=this.save.loadout[i];
            this.save.loadout[i]=this.save.loadout[data.from];
            this.save.loadout[data.from]=tmp;
            saveData(this.save);
            this._selectedSlot=null;
            this._renderLoadout();
          }else if(data.type==="unit"){
            this._placeUnitInSlot(data.name,i);
          }
        }catch(err){}
      };
      la.appendChild(card);
    });
  },
  // Place a unit into a specific loadout slot, handling duplicates.
  _placeUnitInSlot(name,slot){
    // If unit is already in another slot, swap them
    const existing=this.save.loadout.indexOf(name);
    if(existing>=0&&existing!==slot){
      const tmp=this.save.loadout[slot];
      this.save.loadout[slot]=name;
      this.save.loadout[existing]=tmp;
    }else{
      this.save.loadout[slot]=name;
    }
    saveData(this.save);
    this._selectedSlot=null;
    this._renderLoadout();
    this.renderSynergyMeter();
  },
  // Filter and render the collection based on search/role filter.
  filterDeck(){
    this._renderCollection();
  },
  _renderCollection(){
    let area=$("deckArea");
    if(!area)return;
    area.innerHTML="";
    const coll=this.collectionUnits();
    // Get filter values.
    const searchEl=$("deckSearch");
    const roleEl=$("deckRoleFilter");
    const sortEl=$("deckSort");
    const searchTerm=(searchEl?.value||"").toLowerCase().trim();
    const roleFilter=roleEl?.value||"";
    const sortBy=sortEl?.value||"power";
    // Filter collection.
    let filtered=coll;
    if(searchTerm){
      filtered=filtered.filter(u=>
        u.n.toLowerCase().includes(searchTerm)||
        (u.ability&&u.ability!=="none"&&u.ability.toLowerCase().includes(searchTerm))||
        (u.role&&u.role.toLowerCase().includes(searchTerm))
      );
    }
    if(roleFilter){
      filtered=filtered.filter(u=>u.role===roleFilter);
    }
    // Sort collection.
    const rarityOrder={legendary:3,rare:2,common:1};
    const abBonus={none:0,splash:15,heal:20,dodge:25,poison:15,spawn:20,lifesteal:20,explode:15,heal_burst:20,shield:25,rage:20,slow:10,ramp:25,thorns:15,blink_strike:25,frenzy:20,regen:15,cleanse:15,taunt:20,executioner:25,chain_lightning:25};
    const unitPower=u=>{
      const lvl=this.unitLevel(u.n);
      const hp=u.h*(1+0.1*lvl),dmg=u.d*(1+0.1*lvl);
      let s=hp*0.5+dmg*2+u.r*0.3+u.s*0.2+u.a*5+(u.crit||0)*20;
      s+=abBonus[u.ability]||0;
      s+=u.rar==="legendary"?30:u.rar==="rare"?15:0;
      return s;
    };
    filtered=[...filtered].sort((a,b)=>{
      switch(sortBy){
        case "name":return a.n.localeCompare(b.n);
        case "rarity":return (rarityOrder[b.rar]||0)-(rarityOrder[a.rar]||0)||unitPower(b)-unitPower(a);
        case "level":return this.unitLevel(b.n)-this.unitLevel(a.n)||unitPower(b)-unitPower(a);
        case "hp":return b.h-a.h;
        case "dmg":return b.d-a.d;
        default:return unitPower(b)-unitPower(a);
      }
    });
    // Show filter result count.
    if(searchTerm||roleFilter){
      const info=document.createElement("div");
      info.style.cssText="text-align:center;color:var(--muted);font-size:.72rem;margin:4px 0;";
      info.textContent=`${filtered.length} of ${coll.length} units`;
      area.appendChild(info);
      if(filtered.length===0){
        const empty=document.createElement("div");
        empty.style.cssText="text-align:center;color:var(--muted);margin:12px 0;";
        empty.textContent="No units match your filters.";
        area.appendChild(empty);
        return;
      }
    }
    // Count duplicates in collection for fusion.
    const counts={};
    for(let u of coll)counts[u.n]=(counts[u.n]||0)+1;
    for(let u of filtered){
      const lvl=this.unitLevel(u.n);
      const lvlBadge=lvl>0?`<span class="lvlBadge">Lv${lvl}</span>`:"";
      const canFuse=counts[u.n]>=2;
      const inLoadout=this.save.loadout.includes(u.n);
      // Context-aware hint based on selection state
      let slotTag;
      if(canFuse){
        slotTag=`<br><span style="color:var(--legendary)">tap to fuse</span>`;
      }else if(this._selectedSlot!==null){
        slotTag=inLoadout
          ?`<br><span style="color:var(--accent2)">★ tap to swap into slot ${this._selectedSlot+1}</span>`
          :`<br><span style="color:var(--accent2)">★ tap to fill slot ${this._selectedSlot+1}</span>`;
      }else{
        slotTag=inLoadout
          ?`<br><span style="color:var(--accent2)">in loadout · tap to re-slot</span>`
          :`<br><span style="color:var(--muted)">tap to slot · drag to loadout</span>`;
      }
      const abIcons={none:"",splash:"💥",heal:"💚",dodge:"💨",poison:"☠️",spawn:"✨",lifesteal:"🩸",explode:"💣",heal_burst:"💖",shield:"🛡️",rage:"😤",slow:"🐌",ramp:"📈",thorns:"🌵",blink_strike:"⚡",frenzy:"🔥",regen:"🌿",cleanse:"🧹",taunt:"📣",executioner:"🗡️",chain_lightning:"🌩️"};
      const abIcon=abIcons[u.ability]||"";
      const abLabel=u.ability&&u.ability!=="none"?`<br><span style="color:var(--accent2)">${abIcon} ${u.ability}</span>`:"";
      // Mastery badge: based on total kills across all matches.
      const mastery=this.save.unitMastery?.[u.n];
      let masteryBadge="";
      if(mastery&&mastery.kills>0){
        const totalKills=mastery.kills;
        let tier="",icon="";
        if(totalKills>=100){tier="Master";icon="👑";}
        else if(totalKills>=50){tier="Expert";icon="⭐";}
        else if(totalKills>=20){tier="Adept";icon="🏅";}
        else if(totalKills>=5){tier="Novice";icon="🎯";}
        if(tier)masteryBadge=`<br><span style="color:#fbbf24;font-size:.6rem;">${icon} ${tier} (${totalKills} kills)</span>`;
      }
      const card=document.createElement("div");
      card.className="card";
      card.draggable=true;
      card.dataset.unitName=u.n;
      card.innerHTML=`<canvas width="40" height="40" style="display:block;margin:2px auto;"></canvas><div class="title" style="color:${u.c}">${u.n}${lvlBadge}</div><div class="detail">${u.h} HP · ${u.d} DMG${abLabel}${masteryBadge}${slotTag}</div><button class="btn" style="position:absolute;top:2px;right:2px;font-size:.65rem;padding:1px 4px;opacity:0.6;">ℹ</button>`;
      SpriteRenderer.renderPreview(card.querySelector("canvas"),u);
      // F2: info button opens unit detail view.
      const infoBtn=card.querySelector("button");
      if(infoBtn)infoBtn.onclick=(e)=>{e.stopPropagation();this.showUnitDetail(u);};
      // Custom tooltip (hover + tap) — shows full stats + ability description.
      CardTooltip.attach(card,()=>CardTooltip.unitHtml(u));
      if(canFuse){
        card.style.borderColor="var(--legendary)";
        card.onclick=()=>this.fuseUnit(u.n);
      }else{
        card.onclick=()=>{
          if(this._selectedSlot!==null){
            // Slot selected → fill it directly
            this._placeUnitInSlot(u.n,this._selectedSlot);
          }else{
            // No slot selected → show slot picker popup
            this._showSlotPicker(u.n);
          }
        };
      }
      // Drag support: drag collection unit onto a loadout slot
      card.ondragstart=(e)=>{
        e.dataTransfer.setData("text/plain",JSON.stringify({type:"unit",name:u.n}));
        card.style.opacity="0.5";
      };
      card.ondragend=()=>{card.style.opacity="1";};
      area.appendChild(card);
    }
  },
  // Show a popup with 4 slot buttons to pick which loadout slot to replace.
  _showSlotPicker(name){
    // Remove any existing picker
    const existing=$("slotPicker");
    if(existing)existing.remove();
    const picker=document.createElement("div");
    picker.id="slotPicker";
    picker.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg);border:2px solid var(--accent);border-radius:var(--radius);padding:16px;z-index:1000;box-shadow:0 4px 20px rgba(0,0,0,0.5);";
    picker.innerHTML=`<div style="text-align:center;margin-bottom:12px;font-size:.85rem;color:var(--text);">Place <b style="color:var(--accent2)">${esc(name)}</b> into:</div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;"></div><button class="btn" style="margin-top:12px;width:100%;font-size:.72rem;">Cancel</button>`;
    const slots=picker.querySelector("div:nth-child(2)");
    this.save.loadout.forEach((curName,i)=>{
      const curU=this.collectionUnits().find(x=>x.n===curName)||this.base[0];
      const btn=document.createElement("button");
      btn.className="btn";
      btn.style.cssText="font-size:.72rem;padding:6px 10px;min-width:70px;";
      btn.innerHTML=`Slot ${i+1}<br><span style="color:${curU.c};font-size:.65rem;">${esc(curName)}</span>`;
      btn.onclick=()=>{this._placeUnitInSlot(name,i);picker.remove();};
      slots.appendChild(btn);
    });
    picker.querySelector("button:last-child").onclick=()=>picker.remove();
    document.body.appendChild(picker);
  },

  // Phase 16: synergy meter — analyzes role balance in the loadout.
  renderSynergyMeter(){
    const meter=$("synergyMeter");
    if(!meter)return;
    const units=this.loadoutUnits();
    const roles={};
    const abilities={};
    for(const u of units){
      if(u.role)roles[u.role]=(roles[u.role]||0)+1;
      if(u.ability&&u.ability!=="none")abilities[u.ability]=(abilities[u.ability]||0)+1;
    }
    // Build role summary.
    const roleList=Object.entries(roles).map(([r,c])=>`${r}:${c}`).join(" · ");
    // Warnings for missing/overloaded roles.
    const warnings=[];
    if(!roles["frontline"])warnings.push("⚠ No frontline — backline exposed");
    if(!roles["carry"])warnings.push("⚠ No carry — low DPS");
    if(!roles["support"])warnings.push("⚠ No support — no healing");
    if(!roles["counter"])warnings.push("⚠ No counter — can't dive enemy carries");
    const warnText=warnings.length?`<br><span style="color:#f84">${warnings.join("<br>")}</span>`:`<br><span style="color:#4f4">✓ Balanced loadout</span>`;
    // Synergy score: 0-100 based on role coverage, ability diversity, and role balance.
    let score=0;
    const roleCount=Object.keys(roles).length;
    score+=roleCount*15; // 15 per unique role
    if(roles["frontline"]&&roles["carry"])score+=10; // frontline+carry combo
    if(roles["support"])score+=10; // healing
    if(roles["counter"])score+=5; // divers
    const abilityCount=Object.keys(abilities).length;
    score+=Math.min(20,abilityCount*5); // ability diversity
    // Penalty for too many duplicates.
    const dups=Object.values(roles).filter(c=>c>2).length;
    score-=dups*10;
    score=Math.max(0,Math.min(100,score));
    const scoreColor=score>=70?"#4f4":score>=40?"#fa0":"#f84";
    const scoreLabel=score>=70?"Excellent":score>=40?"Decent":"Needs Work";
    // Calculate actual composition bonuses (same as battle).
    const fakeArmy=units.map(u=>({role:u.role,ability:u.ability}));
    const roleSet=new Set(fakeArmy.map(u=>u.role).filter(Boolean));
    const abSet=new Set(fakeArmy.map(u=>u.ability).filter(a=>a&&a!=="none"));
    const bonusLabels=[];
    if(roleSet.size>=3)bonusLabels.push(`+${3*(roleSet.size-2)}% HP (role diversity)`);
    if(roleSet.has("frontline")&&roleSet.has("carry"))bonusLabels.push("+5% DMG (frontline+carry)");
    if(roleSet.has("support"))bonusLabels.push("+5% HP (support)");
    if(roleSet.has("counter"))bonusLabels.push("+5% SPD (counter)");
    if(abSet.size>=2)bonusLabels.push(`+${Math.min(8,2*(abSet.size-1))}% DMG (ability diversity)`);
    if(abSet.has("heal")&&abSet.has("heal_burst"))bonusLabels.push("+5% HP (double heal)");
    if(abSet.has("taunt")&&(abSet.has("heal")||abSet.has("shield")))bonusLabels.push("+10% HP (tank+support)");
    const bonusText=bonusLabels.length?`<br><span style="color:var(--accent2);font-size:.7rem;">⚡ Active Bonuses: ${bonusLabels.join(" · ")}</span>`:"";
    meter.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><b>Roles:</b><span>${roleList||"empty"}</span></div>`+
      `<div style="margin:4px 0;"><b>Synergy:</b> <span style="color:${scoreColor};font-weight:700;">${score}/100 (${scoreLabel})</span></div>`+
      `${warnText}${bonusText}`;
  },

  // Phase 13: swap a loadout slot — now selects the slot for picking.
  swapLoadoutSlot(i){
    this._selectedSlot=(this._selectedSlot===i)?null:i;
    this._renderLoadout();
    this._renderCollection();
  },

  // Phase 13: add a collection unit — uses slot picker or selected slot.
  // When called programmatically (no UI context), replaces first available slot.
  addToLoadout(name){
    if(this._selectedSlot!==null){
      this._placeUnitInSlot(name,this._selectedSlot);
    }else{
      // Programmatic fallback: find first empty/dup slot, else slot 0.
      const existingSlot=this.save.loadout.indexOf(name);
      if(existingSlot>=0){
        // Already in loadout — no-op for programmatic call
        return;
      }
      const dupSlot=this.save.loadout.findIndex(n=>this.save.loadout.filter(x=>x===n).length>1);
      this.save.loadout[dupSlot>=0?dupSlot:0]=name;
      saveData(this.save);
      this._renderLoadout();
      this.renderSynergyMeter();
    }
  },

  // Phase 6/13: fuse two same-name units into one with +1 level.
  // Phase 13 (Open Q8): takes the higher of each stat (hp, dmg, range, speed),
  // keeps the first unit's behaviour fields + recipe (no averaging).
  fuseUnit(name){
    if(this.unitLevel(name)>=10){toast(t("max_level"));return;}
    const coll=this.save.collection||[];
    const matches=coll.filter(u=>u.n===name);
    if(matches.length<2){toast(t("need_fuse"));return;}
    // Show fusion preview modal.
    this._showFusionPreview(name,matches);
  },
  _showFusionPreview(name,matches){
    const a=matches[0],b=matches[1];
    const lvl=this.unitLevel(name);
    const newLvl=lvl+1;
    // Calculate merged stats (higher of each).
    const mergedH=Math.max(a.h,b.h);
    const mergedD=Math.max(a.d,b.d);
    const mergedR=Math.max(a.r,b.r);
    const mergedS=Math.max(a.s,b.s);
    // Apply upgrade bonus for current and new level (consistent before/after).
    const curBonus=lvl*0.1;
    const newBonus=newLvl*0.1;
    const curH=Math.round(a.h*(1+curBonus));
    const curD=Math.round(a.d*(1+curBonus));
    const newH=Math.round(mergedH*(1+newBonus));
    const newD=Math.round(mergedD*(1+newBonus));
    const overlay=document.createElement("div");
    overlay.id="fusePreviewModal";
    overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;";
    overlay.onclick=()=>overlay.remove();
    const modal=document.createElement("div");
    modal.style.cssText="background:var(--card);border:1px solid var(--legendary);border-radius:var(--radius);padding:20px;max-width:300px;width:90%;text-align:center;box-shadow:0 0 20px rgba(251,191,36,.2);";
    modal.onclick=e=>e.stopPropagation();
    modal.innerHTML=
      `<div style="font-weight:700;font-size:1rem;margin-bottom:12px;color:var(--legendary);">🔮 Fusion Preview</div>`+
      `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin:12px 0;">`+
      `<div style="flex:1;"><div style="font-weight:700;color:${a.c};font-size:.8rem;">${a.n}</div>`+
      `<div style="font-size:.7rem;color:var(--muted);">Lv${lvl}</div>`+
      `<div style="font-size:.65rem;">${a.h} HP · ${a.d} DMG</div></div>`+
      `<div style="font-size:1.5rem;color:var(--legendary);">+</div>`+
      `<div style="flex:1;"><div style="font-weight:700;color:${b.c};font-size:.8rem;">${b.n}</div>`+
      `<div style="font-size:.7rem;color:var(--muted);">Lv${lvl}</div>`+
      `<div style="font-size:.65rem;">${b.h} HP · ${b.d} DMG</div></div>`+
      `</div>`+
      `<div style="font-size:1.2rem;margin:8px 0;color:var(--legendary);">↓</div>`+
      `<div style="background:var(--bg);border:1px solid var(--legendary);border-radius:var(--radius);padding:10px;margin:8px 0;">`+
      `<div style="font-weight:700;color:${a.c};font-size:.9rem;">${a.n}</div>`+
      `<div style="font-size:.75rem;color:var(--ok);font-weight:700;">Lv${newLvl}</div>`+
      `<div style="font-size:.7rem;margin-top:4px;">`+
      `<span style="color:var(--ok);">${curH}→${newH} HP</span> · `+
      `<span style="color:var(--ok);">${curD}→${newD} DMG</span></div>`+
      `<div style="font-size:.6rem;color:var(--muted);margin-top:4px;">Takes the higher of each stat + ${Math.round(newBonus*100)}% level bonus</div>`+
      `</div>`+
      `<div style="display:flex;gap:8px;margin-top:12px;">`+
      `<button class="btn" onclick="document.getElementById('fusePreviewModal').remove()" style="flex:1;">Cancel</button>`+
      `<button class="btn primary" id="confirmFuseBtn" style="flex:1;">🔮 Fuse!</button>`+
      `</div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const fuseBtn=modal.querySelector("#confirmFuseBtn");
    if(fuseBtn)fuseBtn.onclick=()=>{
      const m=document.getElementById("fusePreviewModal");
      if(m)m.remove();
      this._confirmFuse(name);
    };
  },
  _confirmFuse(name){
    const coll=this.save.collection||[];
    const matches=coll.filter(u=>u.n===name);
    if(matches.length<2){toast(t("need_fuse"));return;}
    const a=matches[0],b=matches[1];
    a.h=Math.max(a.h,b.h);
    a.d=Math.max(a.d,b.d);
    a.r=Math.max(a.r,b.r);
    a.s=Math.max(a.s,b.s);
    const idx=coll.findIndex(u=>u===b);
    if(idx<0){
      const bIdx=coll.findIndex(u=>u.n===name&&u!==a);
      if(bIdx>=0)coll.splice(bIdx,1);
    }else{
      coll.splice(idx,1);
    }
    this.save.upgrades[name]=(this.save.upgrades[name]||0)+1;
    saveData(this.save);
    this.wins();
    toast(t("forged_to")+name+" → Lv"+this.unitLevel(name));
    Quests.track("fuse");
    this.deck();
  },

  // Phase 6: upgrade screen — spend coins to level up a unit.
  upgrade(){
    this.screen("upgrade");
    setText("upgradeCoins",this.save.coins||0);
    const area=$("upgradeArea");
    if(!area)return;
    area.innerHTML="";
    const seen={};
    for(const u of this.collectionUnits()){
      if(seen[u.n])continue;
      seen[u.n]=true;
      const lvl=this.unitLevel(u.n);
      const maxed=lvl>=10;
      const cost=30+lvl*20;
      const canAfford=this.save.coins>=cost&&!maxed;
      const row=document.createElement("div");
      row.className="upRow";
      row.innerHTML=
        `<div><div class="upName" style="color:${u.c}">${u.n} <span class="lvlBadge">Lv${lvl}</span></div>`+
        `<div class="upStats">${maxed?"MAX LEVEL":`${u.h} HP · ${u.d} DMG → ${F(u.h*(1+0.1*(lvl+1)))} HP · ${F(u.d*(1+0.1*(lvl+1)))} DMG`}</div></div>`+
        `<button class="btn ${canAfford?"primary":""}" ${canAfford?"":"disabled"}>${maxed?"MAX":cost+"💰"}</button>`;
      const btn=row.querySelector("button");
      if(btn)btn.onclick=()=>this.upgradeUnit(u.n,cost);
      area.appendChild(row);
    }
  },

  // Phase 6: spend coins to raise a unit's upgrade level.
  upgradeUnit(name,cost){
    if(this.unitLevel(name)>=10){toast(t("max_level"));GameAudio.sfx("error");return;}
    if(typeof cost!=="number"||isNaN(cost)){toast(t("not_enough_coins"));GameAudio.sfx("error");return;}
    if(this.save.coins<cost){toast(t("not_enough_coins"));GameAudio.sfx("error");return;}
    this.save.coins-=cost;
    this.save.upgrades[name]=(this.save.upgrades[name]||0)+1;
    saveData(this.save);
    this.wins();
    toast("⬆ "+name+t("upgraded_to")+this.unitLevel(name));
    GameAudio.sfx("level_up");
    this.upgrade();
  },

  // Shop: buy random procedurally-generated units with coins.
  shopCost(){return 40+(this.collectionUnits().length*5);},
  _shopOffer:null,
  // Generate a random procedural unit (no LLM needed).
  _randomProcUnit(){
    const roles=UNIT_SCHEMA.properties.role.enum;
    const abilities=UNIT_SCHEMA.properties.ability.enum;
    const bodyPlans=UNIT_SCHEMA.properties.bodyPlan.enum;
    const weapons=UNIT_SCHEMA.properties.weaponType.enum;
    const movements=UNIT_SCHEMA.properties.movement.enum;
    const targetings=UNIT_SCHEMA.properties.targeting.enum;
    const triggers=UNIT_SCHEMA.properties.abilityTrigger.enum;
    const colors=Object.keys(COLOR_MAP);
    const headFeatures=UNIT_SCHEMA.properties.headFeature.enum;
    const backFeatures=UNIT_SCHEMA.properties.backFeature.enum;
    const auras=UNIT_SCHEMA.properties.aura.enum;
    const patterns=UNIT_SCHEMA.properties.patternEnum||UNIT_SCHEMA.properties.pattern.enum;
    const names=["Zyx","Vorn","Krell","Mist","Drek","Thal","Wraith","Gnash","Pyr","Slyth","Vex","Quor","Brak","Felx","Drax","Nyx","Zorn","Kael","Rux","Thyx"];
    const role=roles[F(R()*roles.length)];
    const ability=abilities[F(R()*abilities.length)];
    const isPassive=PASSIVE_ABILITIES.has(ability);
    const trigger=isPassive?"never":triggers.filter(t=>t!=="never")[F(R()*(triggers.length-1))];
    // Stat ranges based on role.
    const hpBase={frontline:120,carry:60,support:50,counter:70,utility:60,assassin:40,bruiser:90};
    const dmgBase={frontline:15,carry:30,support:10,counter:20,utility:12,assassin:35,bruiser:18};
    const rangeBase={frontline:40,carry:120,support:80,counter:50,utility:100,assassin:35,bruiser:45};
    const hp=hpBase[role]+F(R()*40)-20;
    const dmg=dmgBase[role]+F(R()*10)-5;
    const range=rangeBase[role]+F(R()*40)-20;
    const u={
      n:names[F(R()*names.length)]+F(R()*99),
      role,
      targeting:targetings[F(R()*targetings.length)],
      movement:movements[F(R()*movements.length)],
      attackCondition:"always",
      abilityTrigger:trigger,
      moveSpeedMod:80+F(R()*40),
      h:Math.max(20,hp),d:Math.max(5,dmg),r:Math.max(30,range),s:60+F(R()*40),a:1,
      ability,
      bodyPlan:bodyPlans[F(R()*bodyPlans.length)],
      weaponType:weapons[F(R()*weapons.length)],
      c:COLOR_MAP[colors[F(R()*colors.length)]],
      c2:COLOR_MAP[colors[F(R()*colors.length)]],
      sizeMod:["small","medium","large"][F(R()*3)],
      headFeature:headFeatures[F(R()*headFeatures.length)],
      backFeature:backFeatures[F(R()*backFeatures.length)],
      tailFeature:"none",
      aura:auras[F(R()*auras.length)],
      eyeStyle:"normal",
      pattern:patterns[F(R()*patterns.length)],
      weaponStyle:"standard",
      rar:R()<0.7?"common":(R()<0.95?"rare":"legendary"),
    };
    return u;
  },
  shop(){
    this.screen("shop");
    setText("shopCoins",this.save.coins||0);
    setText("shopCost",this.shopCost());
    if(!this._shopOffer)this._generateShopOffer();
    this._renderShopOffer();
  },
  _generateShopOffer(){
    // Generate 3 random procedural units.
    const offering=[];
    for(let i=0;i<3;i++)offering.push(this._randomProcUnit());
    this._shopOffer=offering;
  },
  _renderShopOffer(){
    const area=$("shopOffer");
    if(!area)return;
    area.innerHTML="";
    if(!this._shopOffer||!this._shopOffer.length){
      area.innerHTML="<div class='detail'>No units available. Play matches to unlock more.</div>";
      return;
    }
    const group=document.createElement("div");
    group.className="group";
    for(const u of this._shopOffer){
      // Simple card for shop (not draftCard which needs roundDraftState).
      const card=document.createElement("div");
      card.className="card rar-"+(u.rar||"common");
      const abDesc=ABILITY_DESCRIPTIONS?.[u.ability]||"";
      card.innerHTML=
        `<div class="title" style="color:${u.c}">${u.n}</div>`+
        `<div class="detail">${u.role||""} · ${u.h}HP · ${u.d}DMG<br>${u.ability!=="none"?`<span style="color:var(--accent2)">${u.ability}</span>`:""}${abDesc?"<br>"+abDesc:""}</div>`;
      card.onclick=()=>this.showUnitDetail(u);
      group.appendChild(card);
    }
    area.appendChild(group);
    const btn=$("buyBtn");
    if(btn){
      const cost=this.shopCost();
      btn.disabled=this.save.coins<cost;
      btn.innerHTML=`🎲 Buy Random Unit (${cost} coins)`;
    }
    const rerollBtn=$("rerollShopBtn");
    if(rerollBtn){
      rerollBtn.disabled=(this.save.coins||0)<10;
    }
  },
  buyShopUnit(){
    const cost=this.shopCost();
    if(this.save.coins<cost){toast(t("not_enough_coins"));return;}
    if(!this._shopOffer||!this._shopOffer.length){toast("No units available");return;}
    // Pick a random unit from the current offer.
    const u=this._shopOffer[F(R()*this._shopOffer.length)];
    // Add to collection (if not already there).
    if(!this.save.collection)this.save.collection=[];
    if(!this.save.collection.some(c=>c.n===u.n)){
      this.save.collection.push({...u});
      // Cap collection at 50 — but never remove units in the current loadout.
      while(this.save.collection.length>50){
        const loadout=new Set(this.save.loadout||[]);
        const idx=this.save.collection.findIndex(c=>!loadout.has(c.n));
        if(idx<0)break;
        this.save.collection.splice(idx,1);
      }
      this.save.coins-=cost;
      saveData(this.save);
      this.wins();
      toast("✓ Added "+u.n+" to collection!");
    }else{
      toast("You already own "+u.n+"!");
      return;
    }
    this._generateShopOffer();
    this.shop();
  },
  rerollShop(){
    const cost=10;
    if(this.save.coins<cost){toast(t("not_enough_coins"));return;}
    this.save.coins-=cost;
    saveData(this.save);
    this._generateShopOffer();
    this.shop();
  },

  // Codex: browse all abilities, roles, spells, movement, targeting.
  _codexTab:"abilities",
  codex(){
    this.screen("codex");
    this.codexTab(this._codexTab);
  },

  // Player profile screen: comprehensive overview.
  profile(){
    this.screen("profile");
    const el=$("profileContent");
    if(!el)return;
    const s=this.save.stats||{totalDmg:0,totalKills:0,totalMatches:0,totalWins:0,totalSpells:0};
    const wr=s.totalMatches>0?Math.round(s.totalWins/s.totalMatches*100):0;
    const lvl=this.playerLevel();
    const arena=this.arenas[this.save.arena||0];
    const endlessLvl=this.save.endlessLevel||0;
    const coll=this.collectionUnits();
    const achievements=this.save.achievements||{};
    const achCount=Object.keys(achievements).filter(k=>achievements[k]).length;
    const achTotal=Object.keys(this.achievements).length;
    const mastery=this.save.unitMastery||{};
    const masteryUnits=Object.keys(mastery).filter(n=>mastery[n].kills>=5);
    // Player title based on level.
    let title="Rookie";
    if(lvl>=10)title="Legend";
    else if(lvl>=7)title="Champion";
    else if(lvl>=5)title="Veteran";
    else if(lvl>=3)title="Warrior";
    // Badges/achievements summary.
    let html="";
    // Header with title.
    html+=`<div style="text-align:center;margin:10px 0;padding:16px;background:var(--card);border:1px solid var(--accent);border-radius:var(--radius);">`;
    html+=`<div style="font-size:2rem;">${lvl>=10?"👑":lvl>=5?"⭐":"🎮"}</div>`;
    html+=`<div style="font-size:1.2rem;font-weight:700;color:var(--accent);margin:4px 0;">${title}</div>`;
    html+=`<div style="font-size:.8rem;color:var(--muted);">Level ${lvl} · ${this.save.xp||0} XP</div>`;
    html+=`</div>`;
    // Key stats grid.
    html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;'>";
    const cards=[
      {label:"Total Wins",value:this.save.matchWins||0,icon:"🏆",color:"var(--ok)"},
      {label:"Win Rate",value:wr+"%",icon:"📈",color:wr>=50?"var(--ok)":"var(--warn)"},
      {label:"Best Streak",value:this.save.bestStreak||0,icon:"🔥",color:"#fb923c"},
      {label:"Endless Level",value:endlessLvl,icon:"♾️",color:"#f0f"},
      {label:"Collection",value:coll.length,icon:"📦",color:"var(--accent)"},
      {label:"Achievements",value:achCount+"/"+achTotal,icon:"🏅",color:"var(--accent2)"},
      {label:"Coins",value:this.save.coins||0,icon:"💰",color:"#fbbf24"},
      {label:"Mastery Units",value:masteryUnits.length,icon:"⚔️",color:"var(--accent2)"},
    ];
    for(const c of cards){
      html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center;">`+
        `<div style="font-size:1.3rem;">${c.icon}</div>`+
        `<div style="font-size:1rem;font-weight:700;color:${c.color};margin:2px 0;">${c.value}</div>`+
        `<div style="font-size:.65rem;color:var(--muted);">${c.label}</div></div>`;
    }
    html+="</div>";
    // Current arena.
    html+=`<div style="background:var(--card);border:1px solid ${arena?.c||"var(--border)"};border-radius:var(--radius);padding:10px;margin:8px 0;text-align:center;">`+
      `<div style="font-size:.75rem;color:var(--muted);">Current Arena</div>`+
      `<div style="font-size:.9rem;font-weight:700;color:${arena?.c}">⚔️ ${arena?.n||"Unknown"}</div>`+
      (endlessLvl>0?`<div style="font-size:.7rem;color:#f0f;">Endless Level ${endlessLvl}</div>`:"")+
      `</div>`;
    // Top mastery units.
    const topMastery=Object.entries(mastery)
      .filter(([n,m])=>m.kills>0)
      .sort((a,b)=>b[1].kills-a[1].kills)
      .slice(0,3);
    if(topMastery.length>0){
      html+="<div style='margin:10px 0;font-weight:700;font-size:.85rem;'>⚔️ Top Units by Kills</div>";
      html+="<div style='display:flex;flex-direction:column;gap:4px;'>";
      for(const [name,m] of topMastery){
        const unit=coll.find(u=>u.n===name);
        const color=unit?.c||"var(--text)";
        let badge="";
        if(m.kills>=100)badge="👑 Master";
        else if(m.kills>=50)badge="⭐ Expert";
        else if(m.kills>=20)badge="🏅 Adept";
        else if(m.kills>=5)badge="🎯 Novice";
        html+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--card);border-radius:var(--radius-sm);">`+
          `<span style="color:${color};font-weight:700;font-size:.78rem;">${name}</span>`+
          `<span style="font-size:.7rem;color:var(--muted);">${badge} · ${m.kills} kills · ${m.matches} matches</span></div>`;
      }
      html+="</div>";
    }
    // Lifetime damage and kills.
    html+=`<div style="display:flex;gap:8px;margin:10px 0;">`+
      `<div style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center;">`+
      `<div style="font-size:1rem;">💥</div>`+
      `<div style="font-size:.9rem;font-weight:700;color:#fb7185;">${Math.round(s.totalDmg||0).toLocaleString()}</div>`+
      `<div style="font-size:.6rem;color:var(--muted);">Lifetime Damage</div></div>`+
      `<div style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center;">`+
      `<div style="font-size:1rem;">💀</div>`+
      `<div style="font-size:.9rem;font-weight:700;color:#fca5a5;">${s.totalKills||0}</div>`+
      `<div style="font-size:.6rem;color:var(--muted);">Lifetime Kills</div></div>`+
      `<div style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center;">`+
      `<div style="font-size:1rem;">✨</div>`+
      `<div style="font-size:.9rem;font-weight:700;color:var(--accent2);">${s.totalSpells||0}</div>`+
      `<div style="font-size:.6rem;color:var(--muted);">Spells Cast</div></div></div>`;
    // Prediction accuracy.
    const ps=this.save.predStats;
    if(ps&&ps.total>0){
      const acc=Math.round(ps.correct/ps.total*100);
      html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:8px;margin:8px 0;text-align:center;">`+
        `<span style="font-size:.7rem;color:var(--muted);">🔮 Prediction Accuracy: </span>`+
        `<span style="font-size:.75rem;font-weight:700;color:${acc>=70?"var(--ok)":acc>=50?"var(--warn)":"#fb7185"};">${acc}% (${ps.correct}/${ps.total})</span></div>`;
    }
    el.innerHTML=html;
  },

  // Stats screen: show global battle statistics.
  stats(){
    this.screen("stats");
    const s=this.save.stats||{totalDmg:0,totalKills:0,totalMatches:0,totalWins:0,totalSpells:0};
    const wr=s.totalMatches>0?Math.round(s.totalWins/s.totalMatches*100):0;
    const avgDmg=s.totalMatches>0?Math.round(s.totalDmg/s.totalMatches):0;
    const el=$("statsContent");
    if(!el)return;
    const cards=[
      {label:"Total Matches",value:s.totalMatches||0,icon:"⚔️",color:"var(--accent)"},
      {label:"Wins",value:s.totalWins||0,icon:"🏆",color:"var(--ok)"},
      {label:"Win Rate",value:wr+"%",icon:"📈",color:wr>=50?"var(--ok)":"var(--warn)"},
      {label:"Total Damage",value:Math.round(s.totalDmg||0).toLocaleString(),icon:"💥",color:"#fb7185"},
      {label:"Total Kills",value:s.totalKills||0,icon:"💀",color:"#fca5a5"},
      {label:"Spells Cast",value:s.totalSpells||0,icon:"✨",color:"var(--accent2)"},
      {label:"Avg Dmg/Match",value:avgDmg.toLocaleString(),icon:"📊",color:"#60a5fa"},
      {label:"Best Streak",value:this.save.bestStreak||0,icon:"🔥",color:"#fb923c"},
      {label:"Endless Level",value:this.save.endlessLevel||0,icon:"♾️",color:"#f0f"},
      {label:"Collection Size",value:this.collectionUnits().length,icon:"📦",color:"var(--accent)"},
    ];
    let html="<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;'>";
    for(const c of cards){
      html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:12px;text-align:center;">`+
        `<div style="font-size:1.5rem;">${c.icon}</div>`+
        `<div style="font-size:1.2rem;font-weight:700;color:${c.color};margin:4px 0;">${c.value}</div>`+
        `<div style="font-size:.7rem;color:var(--muted);">${c.label}</div></div>`;
    }
    html+="</div>";
    // Match history analysis: win rate by arena and difficulty.
    const replays=this.save.replays||[];
    if(replays.length>0){
      // Win rate by arena.
      const byArena={};
      const byDifficulty={};
      for(const r of replays){
        const arena=r.arena||0;
        const diff=r.difficulty||"normal";
        if(!byArena[arena])byArena[arena]={wins:0,total:0};
        byArena[arena].total++;
        if(r.winner==="player")byArena[arena].wins++;
        if(!byDifficulty[diff])byDifficulty[diff]={wins:0,total:0};
        byDifficulty[diff].total++;
        if(r.winner==="player")byDifficulty[diff].wins++;
      }
      html+="<div style='margin:14px 0 6px;font-weight:700;font-size:.85rem;'>📈 Win Rate by Arena</div>";
      html+="<div style='display:flex;flex-direction:column;gap:4px;'>";
      for(const arena of Object.keys(byArena).sort((a,b)=>a-b)){
        const data=byArena[arena];
        const wr=Math.round(data.wins/data.total*100);
        const arenaName=this.arenas[arena]?.n||"Unknown";
        const barColor=wr>=50?"var(--ok)":"var(--warn)";
        html+=`<div style="display:flex;align-items:center;gap:8px;font-size:.75rem;">`+
          `<span style="min-width:80px;">${arenaName}</span>`+
          `<div style="flex:1;height:16px;background:var(--bg);border-radius:8px;overflow:hidden;">`+
          `<div style="width:${wr}%;height:100%;background:${barColor};border-radius:8px;transition:width .3s;"></div></div>`+
          `<span style="min-width:60px;text-align:right;color:${barColor};font-weight:700;">${data.wins}/${data.total} (${wr}%)</span></div>`;
      }
      html+="</div>";
      // Win rate by difficulty.
      html+="<div style='margin:14px 0 6px;font-weight:700;font-size:.85rem;'>🎯 Win Rate by Difficulty</div>";
      html+="<div style='display:flex;flex-direction:column;gap:4px;'>";
      for(const diff of ["easy","normal","hard"]){
        if(!byDifficulty[diff])continue;
        const data=byDifficulty[diff];
        const wr=Math.round(data.wins/data.total*100);
        const barColor=wr>=50?"var(--ok)":"var(--warn)";
        const diffColor=diff==="easy"?"var(--ok)":diff==="hard"?"var(--warn)":"var(--accent2)";
        html+=`<div style="display:flex;align-items:center;gap:8px;font-size:.75rem;">`+
          `<span style="min-width:80px;color:${diffColor};font-weight:700;text-transform:uppercase;">${diff}</span>`+
          `<div style="flex:1;height:16px;background:var(--bg);border-radius:8px;overflow:hidden;">`+
          `<div style="width:${wr}%;height:100%;background:${barColor};border-radius:8px;transition:width .3s;"></div></div>`+
          `<span style="min-width:60px;text-align:right;color:${barColor};font-weight:700;">${data.wins}/${data.total} (${wr}%)</span></div>`;
      }
      html+="</div>";
      // Recent form: last 10 matches.
      html+="<div style='margin:14px 0 6px;font-weight:700;font-size:.85rem;'>📋 Recent Form (last 10)</div>";
      const recent=replays.slice(0,10).reverse();
      html+="<div style='display:flex;gap:3px;justify-content:center;flex-wrap:wrap;'>";
      for(const r of recent){
        const draw=r.winner==="draw";
        const win=r.winner==="player";
        const icon=draw?"D":win?"W":"L";
        const color=draw?"var(--muted)":win?"var(--ok)":"var(--warn)";
        html+=`<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;border-radius:4px;font-size:.7rem;font-weight:700;">${icon}</div>`;
      }
      html+="</div>";
    }
    // Win prediction accuracy.
    const ps=this.save.predStats;
    if(ps&&ps.total>0){
      const acc=Math.round(ps.correct/ps.total*100);
      const accColor=acc>=70?"var(--ok)":acc>=50?"var(--warn)":"#fb7185";
      html+="<div style='margin:14px 0 6px;font-weight:700;font-size:.85rem;'>🔮 Prediction Accuracy</div>";
      html+=`<div style="display:flex;gap:8px;justify-content:center;font-size:.75rem;">`+
        `<div style="background:var(--card);border:1px solid ${accColor};border-radius:var(--radius-sm);padding:8px 12px;text-align:center;">`+
        `<div style="font-size:1.1rem;font-weight:700;color:${accColor};">${acc}%</div>`+
        `<div style="font-size:.6rem;color:var(--muted);">Correct (${ps.correct}/${ps.total})</div></div>`+
        `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;text-align:center;">`+
        `<div style="font-size:1.1rem;font-weight:700;color:var(--accent2);">${ps.avgError}%</div>`+
        `<div style="font-size:.6rem;color:var(--muted);">Avg Error</div></div></div>`;
    }
    el.innerHTML=html;
  },

  // Achievements screen: browse all achievements, locked/unlocked.
  achievementsScreen(){
    this.screen("achievements");
    const a=this.save.achievements||{};
    const keys=Object.keys(this.achievements);
    const unlocked=keys.filter(k=>a[k]).length;
    const progEl=$("achProgress");
    if(progEl)progEl.textContent=`${unlocked} / ${keys.length} unlocked`;
    const el=$("achContent");
    if(!el)return;
    let html="";
    for(const key of keys){
      const ach=this.achievements[key];
      const isUnlocked=!!a[key];
      const icon=isUnlocked?"🏆":"🔒";
      const opacity=isUnlocked?"1":"0.5";
      const borderColor=isUnlocked?"var(--ok)":"var(--border)";
      const nameColor=isUnlocked?"var(--ok)":"var(--muted)";
      // Progress bar for locked achievements.
      let progressHtml="";
      if(!isUnlocked&&ach.progress){
        try{
          const progText=ach.progress(this);
          const parts=progText.split("/");
          const current=parseFloat(parts[0].replace(/,/g,""))||0;
          const target=parseFloat(parts[1].replace(/,/g,""))||1;
          const pct=Math.min(100,Math.round(current/target*100));
          progressHtml=`<div style="margin-top:4px;"><div style="font-size:.6rem;color:var(--muted);text-align:right;">${progText}</div>`+
            `<div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-top:2px;">`+
            `<div style="width:${pct}%;height:100%;background:var(--accent);border-radius:3px;transition:width .3s;"></div></div></div>`;
        }catch(e){}
      }
      html+=`<div style="background:var(--card);border:1px solid ${borderColor};border-radius:var(--radius);padding:10px;margin:6px 0;opacity:${opacity};display:flex;align-items:center;gap:10px;">`+
        `<div style="font-size:1.5rem;flex-shrink:0;">${icon}</div>`+
        `<div style="flex:1;"><div style="font-weight:700;color:${nameColor};font-size:.85rem;">${ach.name}</div>`+
        `<div style="color:var(--muted);font-size:.75rem;">${ach.desc}</div>${progressHtml}</div></div>`;
    }
    el.innerHTML=html;
  },

  // Match history screen: view recent match replays.
  replaysScreen(){
    this.screen("replays");
    const el=$("replayContent");
    if(!el)return;
    const replays=this.save.replays||[];
    if(replays.length===0){
      el.innerHTML="<div style='text-align:center;color:var(--muted);margin:20px 0;'>No matches yet. Play a match to see your history!</div>";
      return;
    }
    let html="";
    for(let i=0;i<replays.length;i++){
      const r=replays[i];
      const win=r.winner==="player";
      const draw=r.winner==="draw";
      const resultColor=draw?"var(--muted)":win?"var(--ok)":"var(--warn)";
      const resultIcon=draw?"🤝":win?"🏆":"💀";
      const arenaName=this.arenas[r.arena]?.n||"Unknown";
      // Round history icons.
      let roundIcons="";
      if(r.roundHistory&&r.roundHistory.length){
        roundIcons=r.roundHistory.map(h=>h.winner==="player"?"✅":h.winner==="enemy"?"❌":"➖").join(" ");
      }
      // MVP info.
      let mvpText="";
      if(r.mvp){mvpText=`<div style="font-size:.7rem;color:var(--accent2);margin-top:2px;">🏆 ${r.mvp.name} — ${r.mvp.dmg} dmg${r.mvp.kills>0?`, ${r.mvp.kills} kills`:""}</div>`;}
      // Difficulty/endless badges.
      let badges="";
      if(r.difficulty&&r.difficulty!=="normal")badges+=`<span style="font-size:.6rem;background:var(--accent);color:#fff;padding:1px 4px;border-radius:4px;margin-right:4px;">${r.difficulty.toUpperCase()}</span>`;
      if(r.endlessLevel>0)badges+=`<span style="font-size:.6rem;background:#f0f;color:#fff;padding:1px 4px;border-radius:4px;">♾️${r.endlessLevel}</span>`;
      html+=`<div style="background:var(--card);border:1px solid ${resultColor};border-radius:var(--radius);padding:10px;margin:6px 0;">`+
        `<div style="display:flex;justify-content:space-between;align-items:center;">`+
        `<span style="font-size:1.2rem;">${resultIcon}</span>`+
        `<span style="color:${resultColor};font-weight:700;font-size:.85rem;">${draw?"DRAW":win?"VICTORY":"DEFEAT"}</span>`+
        `<span style="font-size:.7rem;color:var(--muted);">${r.date}</span></div>`+
        `<div style="font-size:.75rem;margin:4px 0;">${badges}${arenaName} · ${r.rounds} rounds</div>`+
        `${roundIcons?`<div style="font-size:.8rem;margin:2px 0;">${roundIcons}</div>`:""}`+
        `<div style="font-size:.7rem;color:var(--muted);margin-top:2px;">Army: ${r.units.join(", ")}</div>`+
        `${mvpText}</div>`;
    }
    el.innerHTML=html;
  },

  // Tier list screen: rank units by computed power score.
  _tierTab:"all",
  tierList(){
    this.screen("tierlist");
    this.tierListTab(this._tierTab);
  },
  tierListTab(tab){
    this._tierTab=tab;
    for(const t of ["all","collection"]){
      const btn=$("tierTab"+t.charAt(0).toUpperCase()+t.slice(1));
      if(btn)btn.className="btn"+(t===tab?" primary":"");
    }
    const el=$("tierContent");
    if(!el)return;
    // Get units to rank.
    let units;
    if(tab==="collection"){
      units=this.collectionUnits();
    }else{
      units=[...this.base.map(u=>({...u})),...(this.save.collection||[]).map(u=>({...u}))];
      // Deduplicate by name (base units may also be in collection).
      const seen=new Set();units=units.filter(u=>{if(seen.has(u.n))return false;seen.add(u.n);return true;});
    }
    // Compute power score for each unit.
    const scored=units.map(u=>{
      const lvl=this.unitLevel(u.n);
      const hp=u.h*(1+0.1*lvl);
      const dmg=u.d*(1+0.1*lvl);
      // Power score: weighted combination of stats + ability bonus.
      let score=hp*0.5+dmg*2+u.r*0.3+u.s*0.2+u.a*5+(u.crit||0)*20;
      // Ability bonuses.
      const abBonus={none:0,splash:15,heal:20,dodge:25,poison:15,spawn:20,lifesteal:20,explode:15,heal_burst:20,shield:25,rage:20,slow:10,ramp:25,thorns:15,blink_strike:25,frenzy:20,regen:15,cleanse:15,taunt:20,executioner:25,chain_lightning:25};
      score+=abBonus[u.ability]||0;
      // Rarity bonus.
      score+=u.rar==="legendary"?30:u.rar==="rare"?15:0;
      return {u,score:Math.round(score),lvl};
    }).sort((a,b)=>b.score-a.score);
    // Assign tiers: S (top 15%), A (next 25%), B (next 30%), C (bottom 30%).
    const n=scored.length;
    const sTier=n>0?Math.max(1,Math.ceil(n*0.15)):0;
    const aTier=n>0?Math.max(1,Math.ceil(n*0.40)):0;
    const bTier=n>0?Math.max(1,Math.ceil(n*0.70)):0;
    const tiers=[
      {label:"S",color:"#fbbf24",desc:"Top tier — exceptional stats and abilities"},
      {label:"A",color:"#34d399",desc:"Strong picks — great value"},
      {label:"B",color:"#60a5fa",desc:"Solid picks — viable in most comps"},
      {label:"C",color:"#94a3b8",desc:"Situational — needs the right comp"},
    ];
    let html="";
    for(let t=0;t<tiers.length;t++){
      const start=t===0?0:t===1?sTier:t===2?aTier:bTier;
      const end=t===0?sTier:t===1?aTier:t===2?bTier:n;
      const tierUnits=scored.slice(start,end);
      if(tierUnits.length===0)continue;
      html+=`<div style="margin:10px 0;">`+
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">`+
        `<span style="background:${tiers[t].color};color:#000;font-weight:900;font-size:1rem;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;">${tiers[t].label}</span>`+
        `<span style="font-size:.7rem;color:var(--muted);">${tiers[t].desc}</span></div>`;
      for(let i=0;i<tierUnits.length;i++){
        const {u,score,lvl}=tierUnits[i];
        const abLabel=u.ability&&u.ability!=="none"?`<span style="color:var(--accent2);font-size:.65rem;">${u.ability}</span>`:"";
        const lvlBadge=lvl>0?`<span class="lvlBadge">Lv${lvl}</span>`:"";
        html+=`<div style="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;margin:3px 0;cursor:pointer;" onclick="G.showUnitDetail(this._unitData)" id="tierUnit_${start+i}">`+
          `<span style="color:${u.c};font-weight:700;font-size:.8rem;flex:1;">${u.n}${lvlBadge}</span>`+
          `${abLabel}`+
          `<span style="font-size:.65rem;color:var(--muted);">${u.h}HP ${u.d}DMG</span>`+
          `<span style="font-size:.7rem;font-weight:700;color:${tiers[t].color};">${score}</span></div>`;
      }
      html+="</div>";
    }
    el.innerHTML=html;
    // Attach unit data for onclick.
    for(let i=0;i<scored.length;i++){
      const el2=document.getElementById("tierUnit_"+i);
      if(el2)el2._unitData=scored[i].u;
    }
  },
  codexTab(tab){
    this._codexTab=tab;
    // Update tab button styles.
    for(const t of ["abilities","roles","spells","movement","targeting"]){
      const btn=$("codexTab"+t.charAt(0).toUpperCase()+t.slice(1));
      if(btn)btn.className="btn"+(t===tab?" primary":"");
    }
    const content=$("codexContent");
    if(!content)return;
    let html="";
    if(tab==="abilities"){
      html+="<div style='text-align:center;color:var(--muted);font-size:.8rem;margin-bottom:10px;'>Passive abilities apply automatically. Triggered abilities fire on their trigger condition.</div>";
      for(const ab of ABILITY_OPTS){
        const desc=ABILITY_DESCRIPTIONS[ab]||"";
        const isPassive=PASSIVE_ABILITIES.has(ab);
        const color=isPassive?"var(--accent2)":"var(--accent)";
        html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;margin:6px 0;">`+
          `<div style="font-weight:700;color:${color};font-size:.85rem;">${ab}</div>`+
          `<div style="color:var(--muted);font-size:.75rem;margin-top:2px;">${desc}</div></div>`;
      }
    }else if(tab==="roles"){
      const roleDescs={
        frontline:"Tanky units that hold the front and absorb damage. High HP, low damage.",
        carry:"High-damage units that need protection. Squishy but deadly.",
        support:"Healers and buffers that keep allies alive. Low combat stats.",
        counter:"Aggressive units that dive enemy backlines. High speed, moderate damage.",
        utility:"Flexible units with special abilities. Fill gaps in composition.",
        assassin:"Fragile burst-damage units that target low-HP enemies. High crit.",
        bruiser:"Durable fighters with moderate damage. Between frontline and carry.",
      };
      const roleColors={frontline:"#fb7185",carry:"#fbbf24",support:"#34d399",counter:"#a78bfa",utility:"#60a5fa",assassin:"#f472b6",bruiser:"#fb923c"};
      for(const r of ROLE_OPTS){
        html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;margin:6px 0;">`+
          `<div style="font-weight:700;color:${roleColors[r]||"#fff"};font-size:.85rem;">${r}</div>`+
          `<div style="color:var(--muted);font-size:.75rem;margin-top:2px;">${roleDescs[r]||""}</div></div>`;
      }
    }else if(tab==="spells"){
      html+="<div style='text-align:center;color:var(--muted);font-size:.8rem;margin-bottom:10px;'>Spells are drafted alongside units (30% chance). Tap spell bar to cast manually during battle.</div>";
      const spellDescs={
        damage:"Instant damage to all targets in the area.",
        damage_over_time:"Applies poison damage over time to targets.",
        slow:"Slows enemy movement in the area.",
        stun:"Stuns enemies in the area, preventing action.",
        heal_allies:"Heals all allies in the area.",
        shield_allies:"Grants temporary immunity to allies in the area.",
        summon:"Summons temporary minions to fight.",
        knockback:"Pushes enemies away from the spell center.",
        buff_dmg:"Increases damage of allies in the area.",
        buff_speed:"Increases movement speed of allies in the area.",
      };
      const triggerDescs={
        battle_start:"Fires automatically at battle start.",
        on_first_contact:"Fires when enemies first engage.",
        delayed_3s:"Fires 3 seconds into the battle.",
        when_ally_hurt:"Fires when an ally takes damage.",
        periodic_5s:"Fires every 5 seconds.",
      };
      html+="<div style='font-weight:700;color:var(--accent);font-size:.8rem;margin:10px 0 4px;'>Effects</div>";
      for(const [eff,desc] of Object.entries(spellDescs)){
        html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:8px;margin:4px 0;">`+
          `<span style="font-weight:600;color:var(--accent);font-size:.8rem;">${eff.replace(/_/g," ")}</span>`+
          `<span style="color:var(--muted);font-size:.75rem;"> — ${desc}</span></div>`;
      }
      html+="<div style='font-weight:700;color:var(--accent2);font-size:.8rem;margin:10px 0 4px;'>Triggers</div>";
      for(const [tr,desc] of Object.entries(triggerDescs)){
        html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:8px;margin:4px 0;">`+
          `<span style="font-weight:600;color:var(--accent2);font-size:.8rem;">${tr.replace(/_/g," ")}</span>`+
          `<span style="color:var(--muted);font-size:.75rem;"> — ${desc}</span></div>`;
      }
    }else if(tab==="movement"){
      for(const m of MOVEMENT_OPTS){
        const desc=MOVEMENT_DESCRIPTIONS[m]||"";
        html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;margin:6px 0;">`+
          `<div style="font-weight:700;color:var(--accent);font-size:.85rem;">${m}</div>`+
          `<div style="color:var(--muted);font-size:.75rem;margin-top:2px;">${desc}</div></div>`;
      }
    }else if(tab==="targeting"){
      for(const t of TARGETING_OPTS){
        const desc=TARGETING_DESCRIPTIONS[t]||"";
        html+=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;margin:6px 0;">`+
          `<div style="font-weight:700;color:var(--accent);font-size:.85rem;">${t.replace(/_/g," ")}</div>`+
          `<div style="color:var(--muted);font-size:.75rem;margin-top:2px;">${desc}</div></div>`;
      }
    }
    content.innerHTML=html;
  },

  reset(){showConfirm("Reset progress?",()=>{
    // Nullify in-memory save BEFORE clearing storage so the beforeunload
    // handler (which calls saveDataNow(G.save)) writes an empty save
    // instead of re-writing the old progress.
    this.save={version:0};
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SAVE_BACKUP_KEY);
    // Also clear IndexedDB fallback so loadDataAsync doesn't restore it.
    // The cached _idbDB request may already be "done" (onsuccess already fired),
    // so we can't rely on setting onsuccess again. Instead, open a fresh
    // connection and wait for the clear transaction to complete before reload.
    let cleared=false;
    const doReload=()=>{if(cleared)return;cleared=true;location.reload();};
    try{
      const req=indexedDB.open("promptshowdown",1);
      req.onupgradeneeded=e=>{e.target.result.createObjectStore("kv");};
      req.onsuccess=()=>{
        try{
          const db=req.result;
          if(db.objectStoreNames.contains("kv")){
            const tx=db.transaction("kv","readwrite");
            tx.objectStore("kv").clear();
            tx.oncomplete=()=>{db.close();doReload();};
            tx.onerror=()=>{db.close();doReload();};
            tx.onabort=()=>{db.close();doReload();};
            setTimeout(()=>{db.close();doReload();},2000);
          }else{
            db.close();doReload();
          }
        }catch(e){try{req.result.close();}catch(_){}doReload();}
      };
      req.onerror=doReload;
    }catch(e){doReload();}
    setTimeout(doReload,3000);
  });},

  // Export save data as base64-encoded string.
  exportSave(){
    try{
      const json=JSON.stringify(this.save);
      const b64=btoa(unescape(encodeURIComponent(json)));
      const code="PSV4:"+b64;
      const area=$("saveExportArea");
      if(area){
        area.style.display="block";
        area.value=code;
        area.select();
        document.execCommand("copy");
        toast("Save code copied to clipboard!");
      }
    }catch(e){toast("Export failed: "+(e.message||e));}
  },
  // Import save data from a pasted code.
  importSave(){
    const code=prompt("Paste your save code (starts with PSV4:):");
    if(!code)return;
    try{
      if(!code.startsWith("PSV4:")){toast("Invalid save code");return;}
      const b64=code.slice(5);
      const json=decodeURIComponent(escape(atob(b64)));
      const data=JSON.parse(json);
      if(!data||typeof data!=="object"||Array.isArray(data)){toast("Invalid save data: not an object");return;}
      if(typeof data.version!=="number"||isNaN(data.version)){toast("Invalid save data: missing or invalid version");return;}
      showConfirm("Import will overwrite current progress. Continue?",()=>{
        try{
          const migrated=migrateSave(data);
          if(!migrated){toast("Import failed: migration error");return;}
          // Security: sanitize spell names in imported spellbook.
          if(Array.isArray(migrated.spellbook)){
            migrated.spellbook=migrated.spellbook.map(s=>sanitizeSpell(s)).filter(Boolean);
          }
          // Security: sanitize unit colors in imported collection.
          if(Array.isArray(migrated.collection)){
            migrated.collection=migrated.collection.map(u=>unit(u));
          }
          this.save=migrated;
          saveData(this.save);
          toast("Save imported successfully!");
          this.menu();
        }catch(e){
          toast("Import failed: migration error - "+(e.message||e));
        }
      });
    }catch(e){toast("Import failed: "+(e.message||e));}
  }
};

// Custom tooltip — works on hover (desktop) + tap (mobile).
// Replaces native title attribute which doesn't show on touch devices.
const CardTooltip={
  _el:null,_timer:null,_currentCard:null,
  _el2(){if(!this._el)this._el=$("cardTooltip");return this._el;},
  show(card,html){
    const el=this._el2();if(!el)return;
    el.innerHTML=html;
    el.style.display="block";
    // Position below the card, clamped to viewport.
    const rect=card.getBoundingClientRect();
    const tw=el.offsetWidth,th=el.offsetHeight;
    let x=rect.left+rect.width/2-tw/2;
    let y=rect.bottom+6;
    // Clamp horizontally.
    x=Math.max(8,Math.min(innerWidth-tw-8,x));
    // If no room below, show above.
    if(y+th>innerHeight-8)y=rect.top-th-6;
    el.style.left=x+"px";
    el.style.top=y+"px";
  },
  hide(){
    const el=this._el2();if(el)el.style.display="none";
    this._currentCard=null;
    if(this._timer){clearTimeout(this._timer);this._timer=null;}
  },
  // Attach hover + tap handlers to a card element.
  // htmlFn(card) returns the tooltip HTML string.
  attach(card,htmlFn){
    // Hover (desktop).
    card.addEventListener("mouseenter",()=>{
      if(this._currentCard&&this._currentCard!==card)this.hide();
      this._currentCard=card;
      this._timer=setTimeout(()=>this.show(card,htmlFn(card)),300);
    });
    card.addEventListener("mouseleave",()=>{this.hide();});
    card.addEventListener("mousemove",()=>{
      // Reset show timer on mouse move (debounce).
      if(this._currentCard===card&&this._timer){
        clearTimeout(this._timer);
        this._timer=setTimeout(()=>this.show(card,htmlFn(card)),300);
      }
    });
    // Tap (mobile) — long-press shows tooltip, tap hides.
    let touchStart=0,touchMoved=false;
    card.addEventListener("pointerdown",(e)=>{
      if(e.pointerType!=="touch")return;
      touchStart=Date.now();touchMoved=false;
      this._currentCard=card;
      this._timer=setTimeout(()=>{
        this.show(card,htmlFn(card));
      },400);
    });
    card.addEventListener("pointermove",(e)=>{
      if(e.pointerType!=="touch")return;
      touchMoved=true;this.hide();
    });
    card.addEventListener("pointerup",(e)=>{
      if(e.pointerType!=="touch")return;
      if(this._timer){clearTimeout(this._timer);this._timer=null;}
      // If tooltip is showing, keep it visible (don't hide on tap-release).
      const el=this._el2();
      if(el&&el.style.display==="block")return;
      // Otherwise, this was a quick tap — let the card's onclick fire.
    });
  },
  // Build tooltip HTML for a unit.
  unitHtml(u){
    const abDesc=u.ability&&u.ability!=="none"&&ABILITY_DESCRIPTIONS?.[u.ability]?ABILITY_DESCRIPTIONS[u.ability]:"";
    const abIcon={none:"",splash:"💥",heal:"💚",dodge:"💨",poison:"☠️",spawn:"✨",lifesteal:"🩸",explode:"💣",heal_burst:"💖",shield:"🛡️",rage:"😤",slow:"🐌",ramp:"📈",thorns:"🌵",blink_strike:"⚡",frenzy:"🔥",regen:"🌿",cleanse:"🧹",taunt:"📣",executioner:"🗡️",chain_lightning:"🌩️"}[u.ability]||"";
    let html=`<div class="ttTitle" style="color:${u.c}">${u.n}</div>`;
    html+=`<div class="ttStats">${u.h} HP · ${u.d} DMG · Range ${u.r} · Speed ${u.s} · Atk ${u.a}s</div>`;
    if(u.ability&&u.ability!=="none"){
      html+=`<div class="ttAbility">${abIcon} ${u.ability}</div>`;
      if(abDesc)html+=`<div class="ttAbDesc">${abDesc}</div>`;
    }
    if(u.role)html+=`<div class="ttRole">Role: ${u.role}</div>`;
    html+=`<div class="ttRole">Rarity: ${u.rar} · Cost: ${u.cost}</div>`;
    return html;
  }
};

