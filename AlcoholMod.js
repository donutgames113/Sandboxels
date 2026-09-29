/*
 * Alcohol Crafting Mod for Sandboxels
 * Fully in-depth fermentation, distillation, aging, and beverage crafting system
 *
 * How to use:
 * 1. Open Sandboxels Mod Manager (M key or Mods button)
 * 2. Enter: alcohol_crafting.js  (or the full URL if hosted)
 * 3. Refresh the page
 *
 * Core loop:
 * Sugars / starches + Yeast  →  Fermentation (Mash / Wort / Must)
 * Ferment → Alcohol / Beer / Wine / Cider / etc.
 * Distill (heat Alcohol mixtures) → Spirits (Whiskey, Rum, Vodka, Gin...)
 * Age in Oak / Charred Oak  →  Aged spirits
 * Mix with flavors, fruits, herbs, carbonation → Cocktails & special drinks
 */

// ─────────────────────────────────────────────
// HELPERS & GLOBALS
// ─────────────────────────────────────────────

if (typeof elements.alcohol === "undefined") {
    // Safety if alcohol somehow missing
    elements.alcohol = {
        color: "#c9c5b1",
        behavior: behaviors.LIQUID,
        category: "liquids",
        state: "liquid",
        density: 785,
        burn: 100,
        burnTime: 3,
        fireColor: ["#80ACF0","#96CDFE","#BEE6D4"],
        tempHigh: 78.37,
        stateHigh: "alcohol_gas",
        tempLow: -114,
        stateLow: "alcohol_ice"
    };
}

// Ensure reactions objects exist
function ensureReactions(el) {
    if (!elements[el]) return;
    if (!elements[el].reactions) elements[el].reactions = {};
}

// ─────────────────────────────────────────────
// 1. SUGARS, STARCHES & FERMENTABLE BASES
// ─────────────────────────────────────────────

// Enhanced yeast (more useful)
if (!elements.yeast) {
    elements.yeast = {
        color: ["#f0e8c8","#e8dcb0","#d4c898"],
        behavior: behaviors.POWDER,
        category: "life",
        state: "solid",
        density: 600,
        tempHigh: 50,
        stateHigh: "dead_yeast"
    };
}

elements.dead_yeast = {
    color: "#a09070",
    behavior: behaviors.POWDER,
    category: "life",
    state: "solid",
    density: 600,
    hidden: true,
    desc: "Yeast killed by heat or alcohol. No longer ferments."
};

// Mash – cooked starch slurry ready for fermentation
elements.mash = {
    color: ["#e8d4a8","#d4c090","#c8b078"],
    behavior: behaviors.LIQUID,
    category: "food",
    state: "liquid",
    density: 1050,
    viscosity: 8000,
    tempHigh: 100,
    stateHigh: ["steam","steam","sugar"],
    reactions: {
        "yeast": { elem1: "fermenting_mash", elem2: "yeast", chance: 0.15 },
        "alcohol": { elem1: "beer", chance: 0.02 }
    },
    desc: "Cooked starch slurry (from grain, potato, rice...). Add Yeast to ferment into beer/alcohol."
};

// Wort – sugary liquid from mashed grain (beer precursor)
elements.wort = {
    color: ["#c8a050","#b89040","#a87830"],
    behavior: behaviors.LIQUID,
    category: "food",
    state: "liquid",
    density: 1040,
    viscosity: 2000,
    tempHigh: 100,
    stateHigh: ["steam","caramel"],
    reactions: {
        "yeast": { elem1: "fermenting_wort", elem2: "yeast", chance: 0.2 },
        "hops": { elem1: "hopped_wort", elem2: null, chance: 0.3 }
    },
    desc: "Sugary liquid extracted from mashed grains. Ferment with Yeast for beer. Add Hops for bitterness."
};

elements.hopped_wort = {
    color: ["#a89040","#987830","#886020"],
    behavior: behaviors.LIQUID,
    category: "food",
    state: "liquid",
    density: 1035,
    viscosity: 2200,
    hidden: true,
    reactions: {
        "yeast": { elem1: "fermenting_hopped_wort", elem2: "yeast", chance: 0.2 }
    },
    desc: "Wort that has been boiled with hops."
};

// Must – crushed fruit juice for wine
elements.must = {
    color: ["#6b2040","#8b3050","#a04060"],
    behavior: behaviors.LIQUID,
    category: "food",
    state: "liquid",
    density: 1060,
    viscosity: 3000,
    tempHigh: 100,
    stateHigh: ["steam","sugar"],
    reactions: {
        "yeast": { elem1: "fermenting_must", elem2: "yeast", chance: 0.18 }
    },
    desc: "Crushed fruit juice (especially grapes). Ferment with Yeast to make wine."
};

// Cider must
elements.cider_must = {
    color: ["#e8c060","#d4a840","#c09030"],
    behavior: behaviors.LIQUID,
    category: "food",
    state: "liquid",
    density: 1045,
    viscosity: 2500,
    reactions: {
        "yeast": { elem1: "fermenting_cider", elem2: "yeast", chance: 0.18 }
    },
    desc: "Apple juice ready for fermentation into hard cider."
};

// Molasses (already may exist; enhance)
if (!elements.molasses) {
    elements.molasses = {
        color: ["#3a2010","#4a2a18","#2a1808"],
        behavior: behaviors.LIQUID,
        category: "food",
        state: "liquid",
        density: 1400,
        viscosity: 50000,
        tempHigh: 120,
        stateHigh: "caramel"
    };
}
ensureReactions("molasses");
elements.molasses.reactions.yeast = { elem1: "fermenting_molasses", elem2: "yeast", chance: 0.12 };

// ─────────────────────────────────────────────
// 2. FERMENTING STATES (active fermentation)
// ─────────────────────────────────────────────

function makeFermenting(name, color, product, gasChance, alcoholChance, timeScale) {
    elements[name] = {
        color: color,
        behavior: behaviors.LIQUID,
        category: "food",
        state: "liquid",
        density: 1020,
        viscosity: 3000,
        hidden: true,
        tick: function(pixel) {
            // Slow conversion + CO2 bubbles
            if (Math.random() < 0.008 * (timeScale || 1)) {
                // Produce alcohol
                if (Math.random() < (alcoholChance || 0.4)) {
                    changePixel(pixel, product);
                    return;
                }
            }
            // Occasional CO2
            if (Math.random() < (gasChance || 0.015)) {
                var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
                if (isEmpty(pixel.x+n[0], pixel.y+n[1])) {
                    createPixel("carbon_dioxide", pixel.x+n[0], pixel.y+n[1]);
                }
            }
            // Too hot → kill yeast / stop
            if (pixel.temp > 45) {
                changePixel(pixel, product === "wine" ? "must" : "wort");
            }
            // Too much alcohol already present nearby can slow it, but we keep it simple
        },
        reactions: {
            "alcohol": { chance: 0.01, elem1: product } // finishes faster near alcohol
        },
        desc: "Actively fermenting. Produces CO₂ and slowly turns into " + product.replace(/_/g," ") + "."
    };
}

makeFermenting("fermenting_mash", ["#d4c090","#c8b078","#b8a068"], "alcohol", 0.02, 0.35, 0.8);
makeFermenting("fermenting_wort", ["#b89040","#a87830","#986820"], "beer", 0.025, 0.3, 1);
makeFermenting("fermenting_hopped_wort", ["#a08030","#907020","#806010"], "beer", 0.02, 0.28, 1);
makeFermenting("fermenting_must", ["#7b3050","#8b4060","#9b5070"], "wine", 0.02, 0.25, 0.9);
makeFermenting("fermenting_cider", ["#d4a840","#c09030","#b08020"], "cider", 0.022, 0.3, 1);
makeFermenting("fermenting_molasses", ["#4a2a18","#3a2010","#2a1808"], "rum_wash", 0.015, 0.2, 0.7);

// Rum wash (molasses ferment result before distillation)
elements.rum_wash = {
    color: ["#5a3a20","#4a2a18","#3a2010"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 980,
    viscosity: 4000,
    burn: 40,
    burnTime: 40,
    reactions: {
        "yeast": { chance: 0.05, elem1: "fermenting_molasses" }
    },
    desc: "Fermented molasses wash. Distill (heat carefully) to obtain Rum."
};

// ─────────────────────────────────────────────
// 3. BASE ALCOHOLIC BEVERAGES
// ─────────────────────────────────────────────

// Beer
elements.beer = {
    color: ["#c8a050","#d4b060","#b89040","#e0c870"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1010,
    viscosity: 1500,
    tempHigh: 100,
    stateHigh: ["steam","alcohol_gas","alcohol_gas"],
    burn: 15,
    burnTime: 80,
    fireColor: "#f0d080",
    reactions: {
        "yeast": { chance: 0.01, elem2: null }, // residual yeast dies slowly
        "carbon_dioxide": { elem1: "fizzy_beer", chance: 0.08 },
        "ice": { elem1: "cold_beer", chance: 0.3 },
        "milk": { elem1: "beer", elem2: "beer", chance: 0.05 } // just mixes
    },
    isFood: true,
    desc: "Fermented wort. Light alcohol. Can be carbonated or chilled. Distill for whiskey base."
};

elements.fizzy_beer = {
    color: ["#d4b060","#e0c870","#c8a050"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1005,
    viscosity: 1200,
    hidden: true,
    tick: function(pixel) {
        if (Math.random() < 0.01) {
            var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
            if (isEmpty(pixel.x+n[0], pixel.y+n[1])) {
                createPixel("foam", pixel.x+n[0], pixel.y+n[1]);
            }
        }
    },
    reactions: {
        "ice": { elem1: "cold_beer", chance: 0.4 }
    },
    isFood: true,
    desc: "Carbonated beer. Produces foam."
};

elements.cold_beer = {
    color: ["#b8d0e0","#a0c0d8","#90b0c8"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1012,
    viscosity: 1800,
    tempHigh: 8,
    stateHigh: "beer",
    hidden: true,
    isFood: true,
    desc: "Chilled beer. Warms back into regular beer above 8°C."
};

// Wine
elements.wine = {
    color: ["#6b1028","#8b1838","#4a0c18","#a02040"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 990,
    viscosity: 2000,
    tempHigh: 100,
    stateHigh: ["steam","alcohol_gas"],
    burn: 25,
    burnTime: 60,
    fireColor: "#c04060",
    reactions: {
        "yeast": { chance: 0.008, elem2: null },
        "oak": { elem1: "aged_wine", chance: 0.004 },
        "charred_oak": { elem1: "aged_wine", chance: 0.006 },
        "ice": { elem1: "cold_wine", chance: 0.25 },
        "sugar": { elem1: "sweet_wine", chance: 0.1 },
        "honey": { elem1: "sweet_wine", chance: 0.08 }
    },
    isFood: true,
    desc: "Fermented grape (or fruit) must. Can be aged in oak or sweetened."
};

elements.aged_wine = {
    color: ["#4a0c18","#5a1020","#3a0810"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 985,
    viscosity: 2500,
    burn: 28,
    burnTime: 55,
    hidden: true,
    isFood: true,
    desc: "Wine that has rested against oak. Deeper color and character."
};

elements.sweet_wine = {
    color: ["#8b2040","#a03050","#6b1830"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1020,
    viscosity: 3500,
    hidden: true,
    isFood: true,
    desc: "Wine with added sugar or honey."
};

elements.cold_wine = {
    color: ["#5a2038","#4a1828"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 995,
    tempHigh: 10,
    stateHigh: "wine",
    hidden: true,
    isFood: true
};

// Cider (hard)
elements.cider = {
    color: ["#e0b050","#d4a040","#c89030"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1005,
    viscosity: 1600,
    tempHigh: 100,
    stateHigh: ["steam","alcohol_gas"],
    burn: 18,
    burnTime: 70,
    reactions: {
        "carbon_dioxide": { elem1: "fizzy_cider", chance: 0.1 },
        "ice": { elem1: "cold_cider", chance: 0.3 },
        "cinnamon": { elem1: "spiced_cider", chance: 0.15 }
    },
    isFood: true,
    desc: "Hard cider from fermented apple juice."
};

elements.fizzy_cider = {
    color: ["#e8c060","#d4b050"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1000,
    hidden: true,
    tick: function(pixel) {
        if (Math.random() < 0.012) {
            var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
            if (isEmpty(pixel.x+n[0], pixel.y+n[1])) createPixel("foam", pixel.x+n[0], pixel.y+n[1]);
        }
    },
    isFood: true
};

elements.cold_cider = {
    color: ["#c0d0e0","#b0c0d0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1008,
    tempHigh: 8,
    stateHigh: "cider",
    hidden: true,
    isFood: true
};

elements.spiced_cider = {
    color: ["#c87830","#b86820"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1010,
    viscosity: 2000,
    hidden: true,
    isFood: true,
    desc: "Cider infused with cinnamon."
};

// Mead (honey wine)
elements.mead = {
    color: ["#e8c060","#d4a840","#c09030","#f0d080"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1060,
    viscosity: 4000,
    tempHigh: 100,
    stateHigh: ["steam","alcohol_gas"],
    burn: 22,
    burnTime: 65,
    reactions: {
        "oak": { elem1: "aged_mead", chance: 0.005 },
        "fruit": { elem1: "melomel", chance: 0.08 },
        "juice": { elem1: "melomel", chance: 0.1 }
    },
    isFood: true,
    desc: "Fermented honey wine. Ancient and sweet."
};

elements.aged_mead = {
    color: ["#c09030","#a87820"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1055,
    viscosity: 4500,
    hidden: true,
    isFood: true
};

elements.melomel = {
    color: ["#c86050","#b85040"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1070,
    viscosity: 4200,
    hidden: true,
    isFood: true,
    desc: "Mead fermented or mixed with fruit."
};

// ─────────────────────────────────────────────
// 4. DISTILLATION & SPIRITS
// ─────────────────────────────────────────────

// Distillation is simulated by heating alcoholic liquids so alcohol_gas rises
// and can be condensed (cooled) back into stronger spirits.

// Make base alcohol produce gas more readily when mixed / heated
ensureReactions("alcohol");
elements.alcohol.reactions = elements.alcohol.reactions || {};

// Whiskey – distilled beer / fermented grain, aged in oak
elements.whiskey = {
    color: ["#c87820","#b86818","#d48830","#a85810"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 920,
    viscosity: 1800,
    tempHigh: 85,
    stateHigh: "alcohol_gas",
    tempLow: -25,
    stateLow: "whiskey_ice",
    burn: 70,
    burnTime: 25,
    fireColor: ["#f0a040","#e08020","#ffc060"],
    reactions: {
        "oak": { elem1: "aged_whiskey", chance: 0.006 },
        "charred_oak": { elem1: "aged_whiskey", chance: 0.01 },
        "ice": { elem1: "whiskey_on_rocks", chance: 0.35 },
        "water": { elem1: "whiskey", elem2: "whiskey", chance: 0.05 }, // dilution
        "cola": { elem1: "whiskey_cola", chance: 0.2 },
        "ginger_ale": { elem1: "whiskey_ginger", chance: 0.2 }
    },
    isFood: true,
    desc: "Distilled fermented grain spirit. Age in oak or charred oak. Mix with cola or ginger."
};

elements.aged_whiskey = {
    color: ["#8b4510","#a0522d","#6b3010"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 915,
    viscosity: 2200,
    burn: 75,
    burnTime: 22,
    fireColor: ["#e07020","#c05010"],
    hidden: true,
    isFood: true,
    desc: "Whiskey aged against oak. Darker, smoother, more complex."
};

elements.whiskey_on_rocks = {
    color: ["#d0c0a0","#c0b090"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 950,
    tempHigh: 5,
    stateHigh: "whiskey",
    hidden: true,
    isFood: true
};

elements.whiskey_cola = {
    color: ["#3a2010","#4a2a18"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1020,
    viscosity: 2500,
    hidden: true,
    isFood: true
};

elements.whiskey_ginger = {
    color: ["#d4a060","#c89050"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1015,
    hidden: true,
    isFood: true
};

elements.whiskey_ice = {
    color: "#e8d8c0",
    behavior: behaviors.WALL,
    category: "states",
    state: "solid",
    density: 920,
    tempHigh: -25,
    stateHigh: "whiskey",
    hidden: true
};

// Rum
elements.rum = {
    color: ["#c87830","#b06020","#d48840","#a05018"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 930,
    viscosity: 2000,
    tempHigh: 85,
    stateHigh: "alcohol_gas",
    burn: 65,
    burnTime: 28,
    fireColor: ["#f09030","#e07018"],
    reactions: {
        "oak": { elem1: "aged_rum", chance: 0.007 },
        "charred_oak": { elem1: "aged_rum", chance: 0.012 },
        "lime": { elem1: "daiquiri_base", chance: 0.15 },
        "juice": { elem1: "rum_punch", chance: 0.12 },
        "cola": { elem1: "rum_and_coke", chance: 0.2 },
        "mint": { elem1: "mojito_base", chance: 0.12 },
        "sugar": { elem1: "sweet_rum", chance: 0.1 },
        "ice": { elem1: "rum_on_rocks", chance: 0.3 }
    },
    isFood: true,
    desc: "Distilled from fermented molasses or sugarcane. Great for cocktails."
};

elements.aged_rum = {
    color: ["#8b4518","#6b3010"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 925,
    viscosity: 2400,
    burn: 70,
    burnTime: 25,
    hidden: true,
    isFood: true
};

elements.rum_and_coke = {
    color: ["#2a1808","#3a2010"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1030,
    hidden: true,
    isFood: true
};

elements.rum_punch = {
    color: ["#e05030","#c04028"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1040,
    viscosity: 3000,
    hidden: true,
    isFood: true
};

elements.daiquiri_base = {
    color: ["#e0d080","#d0c070"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 980,
    hidden: true,
    isFood: true,
    desc: "Rum + lime. Add sugar/ice for a proper daiquiri."
};

elements.mojito_base = {
    color: ["#a0c060","#90b050"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 990,
    hidden: true,
    isFood: true,
    desc: "Rum + mint. Add sugar, lime and soda for mojito."
};

elements.sweet_rum = {
    color: ["#d48840","#c87830"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 980,
    viscosity: 3500,
    hidden: true,
    isFood: true
};

elements.rum_on_rocks = {
    color: ["#d0b890","#c0a880"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 960,
    tempHigh: 5,
    stateHigh: "rum",
    hidden: true,
    isFood: true
};

// Vodka (already partially in alcohol.js – enhance)
if (!elements.vodka) {
    elements.vodka = {
        color: "#9FAEC5",
        behavior: behaviors.LIQUID,
        category: "liquids",
        state: "liquid",
        density: 916,
        viscosity: 1300
    };
}
elements.vodka.color = ["#c8d0e0","#b0c0d8","#a0b0c8"];
elements.vodka.burn = 55;
elements.vodka.burnTime = 30;
elements.vodka.fireColor = ["#a0c0e0","#80b0d0"];
elements.vodka.tempHigh = 88;
elements.vodka.stateHigh = "alcohol_gas";
elements.vodka.isFood = true;
elements.vodka.desc = "Neutral distilled spirit. Clean and mixable.";
ensureReactions("vodka");
elements.vodka.reactions.tomato = { elem1: "bloody_mary", chance: 0.15 };
elements.vodka.reactions.juice = { elem1: "vodka_juice", chance: 0.12 };
elements.vodka.reactions.soda = { elem1: "vodka_soda", chance: 0.15 };
elements.vodka.reactions.energy_drink = { elem1: "vodka_energy", chance: 0.15 };
elements.vodka.reactions.ice = { elem1: "vodka_on_rocks", chance: 0.35 };
elements.vodka.reactions.pickle = { elem1: "pickleback", chance: 0.1 };

elements.bloody_mary = {
    color: ["#a03030","#8b2020"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1040,
    viscosity: 4000,
    hidden: true,
    isFood: true,
    desc: "Vodka + tomato. Classic brunch cocktail."
};

elements.vodka_juice = {
    color: ["#e08040","#d07030"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1020,
    hidden: true,
    isFood: true
};

elements.vodka_soda = {
    color: ["#d0e0f0","#c0d0e0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1005,
    hidden: true,
    tick: function(pixel) {
        if (Math.random() < 0.01) {
            var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
            if (isEmpty(pixel.x+n[0], pixel.y+n[1])) createPixel("foam", pixel.x+n[0], pixel.y+n[1]);
        }
    },
    isFood: true
};

elements.vodka_energy = {
    color: ["#40c0e0","#30b0d0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1010,
    hidden: true,
    isFood: true
};

elements.vodka_on_rocks = {
    color: ["#e0e8f0","#d0d8e8"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 940,
    tempHigh: 5,
    stateHigh: "vodka",
    hidden: true,
    isFood: true
};

elements.pickleback = {
    color: ["#608040","#507030"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1020,
    hidden: true,
    isFood: true,
    desc: "Vodka chased with pickle brine energy."
};

// Gin – vodka-like + botanicals (juniper)
elements.gin = {
    color: ["#d0e0d8","#c0d0c8","#b0c0b8"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 940,
    viscosity: 1400,
    tempHigh: 86,
    stateHigh: "alcohol_gas",
    burn: 60,
    burnTime: 28,
    fireColor: ["#a0d0b0","#80c0a0"],
    reactions: {
        "tonic": { elem1: "gin_and_tonic", chance: 0.25 },
        "soda": { elem1: "gin_fizz", chance: 0.15 },
        "lime": { elem1: "gin_rickey", chance: 0.12 },
        "juice": { elem1: "gin_juice", chance: 0.1 },
        "ice": { elem1: "gin_on_rocks", chance: 0.3 },
        "vermouth": { elem1: "martini", chance: 0.2 }
    },
    isFood: true,
    desc: "Distilled spirit flavored with juniper and botanicals. Classic with tonic."
};

elements.gin_and_tonic = {
    color: ["#c0e0d0","#b0d0c0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1008,
    hidden: true,
    tick: function(pixel) {
        if (Math.random() < 0.015) {
            var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
            if (isEmpty(pixel.x+n[0], pixel.y+n[1])) createPixel("foam", pixel.x+n[0], pixel.y+n[1]);
        }
    },
    isFood: true,
    desc: "Gin + tonic water. Refreshing and bitter-sweet."
};

elements.gin_fizz = {
    color: ["#e0f0e8","#d0e0d8"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1000,
    hidden: true,
    isFood: true
};

elements.gin_rickey = {
    color: ["#c0e0b0","#b0d0a0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 990,
    hidden: true,
    isFood: true
};

elements.gin_juice = {
    color: ["#e0d080","#d0c070"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1015,
    hidden: true,
    isFood: true
};

elements.gin_on_rocks = {
    color: ["#e0e8e0","#d0d8d0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 960,
    tempHigh: 5,
    stateHigh: "gin",
    hidden: true,
    isFood: true
};

elements.martini = {
    color: ["#e8e0c8","#d8d0b8"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 950,
    viscosity: 1600,
    hidden: true,
    isFood: true,
    desc: "Gin + vermouth. Stirred or shaken."
};

// Tequila / Mezcal style
elements.tequila = {
    color: ["#e8e0a0","#d8d090","#c8c080"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 935,
    viscosity: 1600,
    tempHigh: 84,
    stateHigh: "alcohol_gas",
    burn: 68,
    burnTime: 26,
    fireColor: ["#e0c060","#d0a040"],
    reactions: {
        "lime": { elem1: "tequila_lime", chance: 0.2 },
        "salt": { elem1: "tequila", chance: 0.05 }, // ritual
        "juice": { elem1: "margarita_base", chance: 0.15 },
        "orange": { elem1: "tequila_sunrise", chance: 0.12 },
        "ice": { elem1: "tequila_on_rocks", chance: 0.3 }
    },
    isFood: true,
    desc: "Spirit from fermented agave. Often served with salt and lime."
};

elements.tequila_lime = {
    color: ["#d0e080","#c0d070"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 970,
    hidden: true,
    isFood: true
};

elements.margarita_base = {
    color: ["#c0e070","#b0d060"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1000,
    viscosity: 2500,
    hidden: true,
    isFood: true,
    desc: "Tequila + citrus. Add salt rim energy for margarita."
};

elements.tequila_sunrise = {
    color: ["#e08030","#d06020","#f0a040"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1030,
    hidden: true,
    isFood: true
};

elements.tequila_on_rocks = {
    color: ["#e8e0c0","#d8d0b0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 955,
    tempHigh: 5,
    stateHigh: "tequila",
    hidden: true,
    isFood: true
};

// Brandy / Cognac style (distilled wine)
elements.brandy = {
    color: ["#c86020","#b05018","#d07030"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 940,
    viscosity: 2100,
    tempHigh: 85,
    stateHigh: "alcohol_gas",
    burn: 72,
    burnTime: 24,
    fireColor: ["#e08030","#c06018"],
    reactions: {
        "oak": { elem1: "aged_brandy", chance: 0.008 },
        "charred_oak": { elem1: "aged_brandy", chance: 0.012 },
        "ice": { elem1: "brandy_on_rocks", chance: 0.3 },
        "coffee": { elem1: "brandy_coffee", chance: 0.12 }
    },
    isFood: true,
    desc: "Distilled wine. Rich and warming. Age in oak."
};

elements.aged_brandy = {
    color: ["#8b3a10","#6b2a08"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 935,
    viscosity: 2600,
    burn: 75,
    burnTime: 22,
    hidden: true,
    isFood: true
};

elements.brandy_on_rocks = {
    color: ["#d0b090","#c0a080"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 965,
    tempHigh: 5,
    stateHigh: "brandy",
    hidden: true,
    isFood: true
};

elements.brandy_coffee = {
    color: ["#4a2a18","#3a2010"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1020,
    viscosity: 3500,
    hidden: true,
    isFood: true
};

// ─────────────────────────────────────────────
// 5. SUPPORTING INGREDIENTS
// ─────────────────────────────────────────────

// Hops
elements.hops = {
    color: ["#6b8f3a","#5a7f2a","#7a9f4a"],
    behavior: behaviors.POWDER,
    category: "food",
    state: "solid",
    density: 400,
    burn: 40,
    burnTime: 40,
    reactions: {
        "wort": { elem1: null, elem2: "hopped_wort", chance: 0.3 },
        "water": { elem1: null, elem2: "hop_tea", chance: 0.1 }
    },
    desc: "Flower cones used to bitter and flavor beer. Add to wort before fermenting."
};

elements.hop_tea = {
    color: ["#a0b060","#90a050"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1005,
    hidden: true,
    desc: "Water infused with hops. Bitter."
};

// Juniper (for gin)
elements.juniper = {
    color: ["#2a4a20","#1a3a10","#3a5a30"],
    behavior: behaviors.POWDER,
    category: "food",
    state: "solid",
    density: 500,
    reactions: {
        "alcohol": { elem1: null, elem2: "gin", chance: 0.08 },
        "vodka": { elem1: null, elem2: "gin", chance: 0.12 },
        "alcohol_gas": { elem1: null, elem2: "gin", chance: 0.15 }
    },
    desc: "Berries that give gin its characteristic flavor. Infuse into neutral spirit."
};

// Oak & Charred Oak for aging
elements.oak = {
    color: ["#8b5a2b","#7a4a1b","#9b6a3b"],
    behavior: behaviors.WALL,
    category: "solids",
    state: "solid",
    density: 750,
    hardness: 0.4,
    breakInto: "sawdust",
    tempHigh: 400,
    stateHigh: "ember",
    burn: 30,
    burnTime: 150,
    burnInto: "charred_oak",
    desc: "Oak wood. Contact with spirits slowly ages them (whiskey, wine, rum, brandy)."
};

elements.charred_oak = {
    color: ["#2a1a08","#1a1000","#3a2a18"],
    behavior: behaviors.WALL,
    category: "solids",
    state: "solid",
    density: 700,
    hardness: 0.35,
    breakInto: "charcoal",
    tempHigh: 600,
    stateHigh: "fire",
    burn: 20,
    burnTime: 200,
    desc: "Charred oak. Accelerates and deepens aging of spirits (classic whiskey barrel)."
};

// Vermouth (fortified wine + herbs)
elements.vermouth = {
    color: ["#c8a060","#b89050","#a88040"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1000,
    viscosity: 2800,
    burn: 30,
    burnTime: 50,
    reactions: {
        "gin": { elem1: "martini", chance: 0.2 },
        "whiskey": { elem1: "manhattan", chance: 0.18 },
        "ice": { elem1: "vermouth", chance: 0.1 }
    },
    isFood: true,
    desc: "Fortified, aromatized wine. Essential for martinis and Manhattans."
};

elements.manhattan = {
    color: ["#8b3020","#7a2818"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 970,
    viscosity: 2000,
    hidden: true,
    isFood: true,
    desc: "Whiskey + vermouth. Classic cocktail."
};

// Tonic water
elements.tonic = {
    color: ["#e0f0f8","#d0e0f0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1015,
    viscosity: 1100,
    reactions: {
        "gin": { elem1: "gin_and_tonic", chance: 0.25 },
        "vodka": { elem1: "vodka_tonic", chance: 0.2 }
    },
    tick: function(pixel) {
        if (Math.random() < 0.008) {
            var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
            if (isEmpty(pixel.x+n[0], pixel.y+n[1])) createPixel("foam", pixel.x+n[0], pixel.y+n[1]);
        }
    },
    isFood: true,
    desc: "Bitter carbonated water flavored with quinine. Perfect with gin."
};

elements.vodka_tonic = {
    color: ["#d0e0f0","#c0d0e0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1010,
    hidden: true,
    isFood: true
};

// Ginger ale / beer
elements.ginger_ale = {
    color: ["#e0c060","#d0b050"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1020,
    viscosity: 1400,
    reactions: {
        "whiskey": { elem1: "whiskey_ginger", chance: 0.2 },
        "rum": { elem1: "dark_and_stormy", chance: 0.18 }
    },
    tick: function(pixel) {
        if (Math.random() < 0.01) {
            var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
            if (isEmpty(pixel.x+n[0], pixel.y+n[1])) createPixel("foam", pixel.x+n[0], pixel.y+n[1]);
        }
    },
    isFood: true,
    desc: "Sweet ginger soda. Mixes well with whiskey or rum."
};

elements.dark_and_stormy = {
    color: ["#6a4020","#5a3018"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1025,
    hidden: true,
    isFood: true,
    desc: "Rum + ginger ale. Dark and spicy."
};

// Mint, lime, cinnamon already partially exist in food mods; provide fallbacks
if (!elements.mint) {
    elements.mint = {
        color: ["#40a040","#309030","#50b050"],
        behavior: behaviors.POWDER,
        category: "food",
        state: "solid",
        density: 300,
        reactions: {
            "rum": { elem1: null, elem2: "mojito_base", chance: 0.12 },
            "water": { elem1: null, elem2: "mint_tea", chance: 0.1 }
        },
        desc: "Fresh mint leaves. Essential for mojitos."
    };
}

if (!elements.lime) {
    elements.lime = {
        color: ["#c0e040","#b0d030","#a0c020"],
        behavior: behaviors.POWDER,
        category: "food",
        state: "solid",
        density: 900,
        breakInto: "juice",
        reactions: {
            "rum": { elem1: null, elem2: "daiquiri_base", chance: 0.15 },
            "tequila": { elem1: null, elem2: "tequila_lime", chance: 0.2 },
            "gin": { elem1: null, elem2: "gin_rickey", chance: 0.12 }
        },
        desc: "Citrus fruit. Brightens many cocktails."
    };
}

if (!elements.cinnamon) {
    elements.cinnamon = {
        color: ["#8b4510","#a0522d"],
        behavior: behaviors.POWDER,
        category: "food",
        state: "solid",
        density: 600,
        reactions: {
            "cider": { elem1: null, elem2: "spiced_cider", chance: 0.15 },
            "mead": { elem1: null, elem2: "spiced_mead", chance: 0.1 }
        },
        desc: "Warm spice. Great in cider and mead."
    };
}

elements.spiced_mead = {
    color: ["#c09040","#b08030"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1070,
    viscosity: 4500,
    hidden: true,
    isFood: true
};

elements.mint_tea = {
    color: ["#80c080","#70b070"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1000,
    hidden: true,
    isFood: true
};

// ─────────────────────────────────────────────
// 6. PRODUCTION REACTIONS (linking base game)
// ─────────────────────────────────────────────

// Yeast + various sugars/starches → fermentable liquids
ensureReactions("yeast");
elements.yeast.reactions = elements.yeast.reactions || {};

// Existing alcohol production paths enhanced
elements.yeast.reactions.sugar_water = { elem1: "yeast", elem2: "fermenting_mash", chance: 0.12 };
elements.yeast.reactions.sugar = { elem1: "yeast", elem2: "fermenting_mash", chance: 0.08 };
elements.yeast.reactions.honey = { elem1: "yeast", elem2: "fermenting_honey", chance: 0.1 };
elements.yeast.reactions.molasses = { elem1: "yeast", elem2: "fermenting_molasses", chance: 0.1 };
elements.yeast.reactions.juice = { elem1: "yeast", elem2: "fermenting_must", chance: 0.1 };
elements.yeast.reactions.soda = { elem1: "yeast", elem2: "fermenting_mash", chance: 0.06 };

// Grain / starch paths
["wheat","rice","corn","potato","mashed_potato","bread","flour","dough"].forEach(function(el) {
    if (elements[el]) {
        ensureReactions(el);
        elements[el].reactions = elements[el].reactions || {};
        elements[el].reactions.yeast = { elem1: "mash", elem2: "yeast", chance: 0.05 };
        elements[el].reactions.water = { elem1: "mash", chance: 0.03, tempMin: 60 };
    }
});

// Potato / grain + water + heat → mash
if (elements.potato) {
    ensureReactions("potato");
    elements.potato.reactions.water = { elem1: "mash", chance: 0.04, tempMin: 70 };
}
if (elements.mashed_potato) {
    ensureReactions("mashed_potato");
    elements.mashed_potato.reactions.yeast = { elem1: "fermenting_mash", elem2: "yeast", chance: 0.12 };
}

// Honey → mead path
elements.fermenting_honey = {
    color: ["#e8c060","#d4a840"],
    behavior: behaviors.LIQUID,
    category: "food",
    state: "liquid",
    density: 1200,
    viscosity: 8000,
    hidden: true,
    tick: function(pixel) {
        if (Math.random() < 0.006) {
            changePixel(pixel, "mead");
            return;
        }
        if (Math.random() < 0.012) {
            var n = adjacentCoords[Math.floor(Math.random()*adjacentCoords.length)];
            if (isEmpty(pixel.x+n[0], pixel.y+n[1])) createPixel("carbon_dioxide", pixel.x+n[0], pixel.y+n[1]);
        }
        if (pixel.temp > 45) changePixel(pixel, "honey");
    },
    desc: "Honey actively fermenting into mead."
};

// Fruit → must
["grape","apple","fruit"].forEach(function(el) {
    if (elements[el]) {
        ensureReactions(el);
        elements[el].reactions = elements[el].reactions || {};
        elements[el].reactions.yeast = { elem1: "must", elem2: "yeast", chance: 0.08 };
        if (el === "apple") {
            elements[el].reactions.yeast = { elem1: "cider_must", elem2: "yeast", chance: 0.1 };
        }
    }
});

// Smash juice into must
if (elements.juice) {
    ensureReactions("juice");
    elements.juice.reactions.yeast = { elem1: "fermenting_must", elem2: "yeast", chance: 0.12 };
}

// Distillation helpers: heating beer/wine/rum_wash/alcohol mixtures releases alcohol_gas
// which can be condensed by cooling back into stronger spirits.

// Beer → whiskey path (conceptual distillation)
ensureReactions("beer");
elements.beer.reactions.fire = { elem1: "alcohol_gas", chance: 0.05 };
elements.beer.tempHigh = 95;
elements.beer.stateHigh = ["steam","alcohol_gas","alcohol_gas","beer"];

// Wine → brandy
ensureReactions("wine");
elements.wine.tempHigh = 95;
elements.wine.stateHigh = ["steam","alcohol_gas","alcohol_gas"];

// Rum wash → rum
ensureReactions("rum_wash");
elements.rum_wash.tempHigh = 90;
elements.rum_wash.stateHigh = ["steam","alcohol_gas","alcohol_gas","rum"];

// Condensing alcohol_gas near cold surfaces or ice can yield spirits
if (elements.alcohol_gas) {
    ensureReactions("alcohol_gas");
    elements.alcohol_gas.reactions = elements.alcohol_gas.reactions || {};
    elements.alcohol_gas.reactions.ice = { elem1: "alcohol", elem2: "water", chance: 0.15 };
    elements.alcohol_gas.reactions.water = { elem1: "vodka", chance: 0.04, tempMax: 20 };
}

// Special: alcohol_gas + juniper → gin vapor then liquid
if (elements.alcohol_gas) {
    elements.alcohol_gas.reactions.juniper = { elem1: "gin", elem2: null, chance: 0.1 };
}

// ─────────────────────────────────────────────
// 7. EXTRA COCKTAILS & MISC
// ─────────────────────────────────────────────

elements.eggnog = {
    color: ["#f0e0b0","#e8d8a0"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1100,
    viscosity: 12000,
    reactions: {
        "rum": { elem1: "rum_eggnog", chance: 0.2 },
        "brandy": { elem1: "brandy_eggnog", chance: 0.2 },
        "whiskey": { elem1: "whiskey_eggnog", chance: 0.15 }
    },
    isFood: true,
    desc: "Creamy holiday drink. Spike it with rum, brandy or whiskey."
};

// Try to link yolk + milk if they exist
if (elements.yolk && elements.milk) {
    ensureReactions("yolk");
    elements.yolk.reactions.milk = { elem1: "eggnog", elem2: "eggnog", chance: 0.08 };
    elements.yolk.reactions.cream = { elem1: "eggnog", chance: 0.1 };
}

elements.rum_eggnog = {
    color: ["#e0c890","#d0b880"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1080,
    viscosity: 10000,
    hidden: true,
    isFood: true
};

elements.brandy_eggnog = {
    color: ["#d0b070","#c0a060"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1075,
    viscosity: 10000,
    hidden: true,
    isFood: true
};

elements.whiskey_eggnog = {
    color: ["#d0a860","#c09850"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1070,
    viscosity: 10000,
    hidden: true,
    isFood: true
};

// Absinthe-style (high proof + herbs) – simplified
elements.absinthe = {
    color: ["#80c040","#70b030","#90d050"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 910,
    viscosity: 1700,
    tempHigh: 80,
    stateHigh: "alcohol_gas",
    burn: 85,
    burnTime: 18,
    fireColor: ["#a0e060","#80c040"],
    reactions: {
        "water": { elem1: "louche", chance: 0.2 },
        "sugar": { elem1: "absinthe", chance: 0.05 },
        "ice": { elem1: "absinthe_frappe", chance: 0.15 }
    },
    isFood: true,
    desc: "High-proof herbal spirit. Turns cloudy (louche) when water is added."
};

elements.louche = {
    color: ["#c0e090","#b0d080"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 960,
    viscosity: 2000,
    hidden: true,
    isFood: true,
    desc: "Absinthe with water – the famous milky louche."
};

elements.absinthe_frappe = {
    color: ["#d0f0a0","#c0e090"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 970,
    tempHigh: 5,
    stateHigh: "absinthe",
    hidden: true,
    isFood: true
};

// ─────────────────────────────────────────────
// 8. HUMAN / LIFE INTERACTIONS (fun effects)
// ─────────────────────────────────────────────

["beer","wine","cider","mead","whiskey","rum","vodka","gin","tequila","brandy","absinthe",
 "aged_whiskey","aged_rum","aged_brandy","aged_wine","martini","gin_and_tonic","bloody_mary"].forEach(function(drink) {
    if (!elements[drink]) return;
    ensureReactions(drink);
    // Calming / slight intoxication flavour (mirrors base alcohol behaviour)
    if (elements.head) {
        elements[drink].reactions.head = elements[drink].reactions.head || { chance: 0.15, elem2: "head" };
    }
    if (elements.body) {
        elements[drink].reactions.body = elements[drink].reactions.body || { chance: 0.15, elem2: "body" };
    }
});

// Strong spirits more likely to affect
["whiskey","rum","vodka","gin","tequila","brandy","absinthe","aged_whiskey","aged_rum"].forEach(function(s) {
    if (elements[s] && elements[s].reactions) {
        if (elements.head) elements[s].reactions.head = { elem2: "head", chance: 0.25 };
        if (elements.body) elements[s].reactions.body = { elem2: "body", chance: 0.25 };
    }
});

// ─────────────────────────────────────────────
// 9. DEDICATED "ALCOHOL" CATEGORY / TAB
// ─────────────────────────────────────────────

// Everything alcohol-related goes into its own tab called "alcohol"
var alcoholElements = [
    // Base & gases
    "alcohol", "alcohol_gas", "alcohol_ice",

    // Fermentable bases
    "mash", "wort", "hopped_wort", "must", "cider_must",
    "fermenting_mash", "fermenting_wort", "fermenting_hopped_wort",
    "fermenting_must", "fermenting_cider", "fermenting_molasses", "fermenting_honey",
    "rum_wash",

    // Finished fermented drinks
    "beer", "fizzy_beer", "cold_beer",
    "wine", "aged_wine", "sweet_wine", "cold_wine",
    "cider", "fizzy_cider", "cold_cider", "spiced_cider",
    "mead", "aged_mead", "melomel", "spiced_mead",

    // Spirits
    "whiskey", "aged_whiskey", "whiskey_on_rocks", "whiskey_ice", "whiskey_cola", "whiskey_ginger",
    "rum", "aged_rum", "rum_on_rocks", "rum_and_coke", "rum_punch", "daiquiri_base", "mojito_base", "sweet_rum",
    "vodka", "vodka_on_rocks", "vodka_juice", "vodka_soda", "vodka_energy", "vodka_tonic", "bloody_mary", "pickleback",
    "gin", "gin_and_tonic", "gin_fizz", "gin_rickey", "gin_juice", "gin_on_rocks", "martini",
    "tequila", "tequila_lime", "margarita_base", "tequila_sunrise", "tequila_on_rocks",
    "brandy", "aged_brandy", "brandy_on_rocks", "brandy_coffee",
    "absinthe", "louche", "absinthe_frappe",

    // Mixers & ingredients
    "vermouth", "manhattan",
    "tonic", "ginger_ale", "dark_and_stormy",
    "hops", "hop_tea", "juniper",
    "oak", "charred_oak",
    "eggnog", "rum_eggnog", "brandy_eggnog", "whiskey_eggnog",
    "mint_tea"
];

alcoholElements.forEach(function(el) {
    if (elements[el]) {
        elements[el].category = "alcohol";
    }
});

// Also force base-game alcohol into the new tab if it exists
if (elements.alcohol) elements.alcohol.category = "alcohol";
if (elements.alcohol_gas) elements.alcohol_gas.category = "alcohol";
if (elements.alcohol_ice) elements.alcohol_ice.category = "alcohol";

// Make the category name look nice in the UI (optional display name)
if (typeof categories !== "undefined") {
    // Some versions support this; safe no-op otherwise
    try { categories.alcohol = "Alcohol"; } catch(e) {}
}

// Log that the mod loaded
console.log("[alcohol_crafting.js] Fully in-depth Alcohol Crafting mod loaded. New 'Alcohol' tab created!");
