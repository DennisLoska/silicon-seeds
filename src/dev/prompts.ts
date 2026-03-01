import { Instruction, Style, StylePrompt } from "../styles/system";

export namespace DevPrompts {
  export function biblical(style: Style): Instruction {
    const title = "epic biblical landscape scenery";
    const name = "biblical";

    const description = `
      - biblical, beige, lush green, middle eastern vibes.
      - People are black or white silhouettes and usually not the center of the scene, but part of it
      - Scenes are about visualization of good virtues or evil deeds
      - Focus on displaying and visualizing love, passion, beauty, joy, spirit
      - There is usually the sun or moon or the stars, gras or sand, lakes, stones
      - The images always show ancient times and should be highly symbolic
      - Never include any signature or words, text or letters
    `;

    const scenes = [
      "The Creation of Stars: God, Celestial Light, The Firmament",
      "The Naming of Animals: Adam, Wisdom and Connection, Eden",
      "The Breath of Life: God and Adam, The Human Spirit, Eden",
      "Enoch Walking with God: Enoch, Fellowship, The Pre-Flood World",
      "Abel’s Heartfelt Offering: Abel, Sincerity, The Altar of Sacrifice",
      "Noah Building the Ark: Noah, Obedience and Labor, Shinar",
      "The Dove Returning with Olive Leaf: The Dove, Peace and Hope, The Ark",
      "The Hospitality of Sarah: Sarah, Generosity, The Tent at Mamre",
      "Isaac and Rebekah’s First Meeting: Isaac and Rebekah, Romantic Love, The Negev Desert",
      "Jacob Wrestling the Angel: Jacob, Spiritual Perseverance, Peniel",
      "Rachel at the Well: Jacob and Rachel, Love at First Sight, Haran",
      "Joseph’s Coat of Many Colors: Jacob and Joseph, Fatherly Favor, Hebron",
      "Joseph Resisting Temptation: Joseph and Potiphar’s Wife, Integrity, Egypt",
      "Joseph Weeping over his Brothers: Joseph, Emotional Release, Pharaoh’s Palace",
      "Moses and the Burning Bush: Moses, Holy Awe, Mount Horeb",
      "The Pillar of Cloud and Fire: The Israelites, Divine Guidance, The Wilderness",
      "The Manna from Heaven: The Israelites, Providence and Gratitude, Desert of Sin",
      "The Crafting of the Tabernacle: Bezalel, Artistic Inspiration, Sinai",
      "The Shining Face of Moses: Moses, Reflected Glory, Mount Sinai",
      "Joshua and the Commander of the Lord’s Army: Joshua, Humility, Jericho",
      "Rahab Hiding the Spies: Rahab, Courageous Faith, Jericho",
      "The Song of Deborah: Deborah and Barak, Victory and Spirit, Mount Tabor",
      "Gideon’s Fleece: Gideon, Seeking Truth, The Threshing Floor",
      "Samson’s Final Sacrifice: Samson, Redemptive Strength, The Temple of Dagon",
      "Hannah’s Silent Prayer: Hannah, Deep Devotion, The Tabernacle at Shiloh",
      "Samuel Anointing David: Samuel and David, Hidden Greatness, Bethlehem",
      "David’s Dance before the Ark: David, Uninhibited Joy, Jerusalem",
      "Abigail Interceding for Peace: Abigail, Diplomacy and Grace, The Wilderness of Maon",
      "Solomon’s Dream of Wisdom: Solomon and God, Intellectual Virtue, Gibeon",
      "Elijah and the Chariot of Fire: Elijah and Elisha, Spiritual Power, The Jordan River",
      "Elisha Multiplying the Widow’s Oil: Elisha and the Widow, Compassion, Israel",
      "Naaman Healing in the Jordan: Naaman, Humility and Restoration, The Jordan River",
      "The Restoration of the Wall: Nehemiah, Community Spirit, Jerusalem",
      "Esther Approaching the King: Esther, Self-Sacrifice, Susa",
      "Job’s Restoration: Job and his Friends, Patience Rewarded, The Land of Uz",
      "The Shepherd’s Psalm: The Shepherd and Sheep, Peace and Security, Green Pastures",
      "The Virtuous Woman: The Proverbs 31 Woman, Industry and Honor, The Household",
      "Isaiah’s Vision of Seraphim: Isaiah, Purity and Calling, The Heavenly Temple",
      "Jeremiah’s Potter and Clay: The Potter, Sovereignty and Shaping, The Potter’s House",
      "Shadrach, Meshach, and Abednego in the Furnace: The Three Youths, Faithfulness, Babylon",
      "Daniel in the Lions' Den: Daniel, Serenity under Pressure, Babylon",
      "Gabriel Visiting Mary: The Angel Gabriel, Divine Favor, Nazareth",
      "The Magnificat: Mary, Soulful Exultation, The Hill Country of Judea",
      "The Shepherds Watching Their Flocks: The Shepherds and Angels, Wonder, Bethlehem",
      "Simeon Holding the Infant Christ: Simeon, Fulfilled Promise, The Temple",
      "The Boy Jesus in the Temple: Jesus and the Teachers, Intellectual Passion, Jerusalem",
      "The Calling of the Fishermen: Jesus and the Disciples, Purpose, Sea of Galilee",
      "The Healing of the Leper: Jesus and the Leper, Touch and Mercy, Galilee",
      "The Centurion’s Faith: The Centurion, Authority and Belief, Capernaum",
      "The Raising of the Widow’s Son: Jesus and the Widow, Compassion, Nain",
      "The Woman with the Alabaster Jar: The Sinful Woman, Tears of Gratitude, Simon’s House",
      "Calming the Storm: Jesus, Peace Amidst Chaos, Sea of Galilee",
      "The Feeding of the Five Thousand: The Multitude, Generosity, Bethsaida",
      "Walking on Water: Jesus and Peter, Courage and Trust, Sea of Galilee",
      "The Healing of the Man Born Blind: Jesus and the Blind Man, Enlightenment, Pool of Siloam",
      "The Good Shepherd Finding the Lost Sheep: The Shepherd, Relentless Love, The Wilderness",
      "Lazarus Coming Forth: Jesus and Lazarus, Life over Death, Bethany",
      "The Triumphal Entry: The Crowds, Collective Joy, The Gates of Jerusalem",
      "Jesus Washing the Disciples' Feet: Jesus, Servanthood, The Upper Room",
      "The Agony in the Garden: Jesus, Internal Conflict and Surrender, Gethsemane",
      "The Penitent Thief on the Cross: Jesus and the Thief, Instant Grace, Calvary",
      "The Women at the Cross: The Marys, Steadfast Loyalty, Golgotha",
      "The Appearance to Thomas: Jesus and Thomas, Understanding and Belief, The Upper Room",
      "The Ascension: Jesus, Transcendence, Mount of Olives",
      "The Healing at the Beautiful Gate: Peter and the Lame Man, Shared Vitality, Jerusalem Temple",
      "Stephen’s Vision of Glory: Stephen, Forgiveness in Death, Outside Jerusalem",
      "Philip and the Ethiopian Eunuch: Philip, Insight and Inclusion, The Road to Gaza",
      "The Conversion of Saul: Paul, Blinding Transformation, The Road to Damascus",
      "Tabitha Being Raised: Peter and Tabitha, Community Love, Joppa",
      "Cornelius’s Vision: Cornelius, Openness to Spirit, Caesarea",
      "The Prison Doors Opening for Peter: The Angel and Peter, Liberation, Jerusalem",
      "Paul and Silas Singing in Prison: Paul and Silas, Joy in Adversity, Philippi",
      "The Lydia’s Conversion: Lydia, Open-Heartedness, Philippi",
      "The Healing Shadows: The Sick and Peter’s Shadow, Collective Hope, Jerusalem Streets",
      "The Fruit of the Spirit Visualization: The Believer, Love, Joy, and Peace, The Inner Soul",
      "The Armor of God: The Believer, Spiritual Readiness, The Heavenly Realms",
      "The Great Cloud of Witnesses: The Saints, Encouragement, The Heavenly Stadium",
      "The Golden Censer of Prayers: The Angel, Intercession, The Heavenly Altar",
      "The Silence in Heaven: The Heavenly Host, Reverence, The Throne Room",
      "The River of the Water of Life: The Saved, Eternal Vitality, The New Jerusalem",
      "The Tree of Life Healing the Nations: The Nations, Unity and Health, The New Jerusalem",
      "Cain’s Envy: Cain and Abel, Jealousy and Malice, The Field",
      "The Tower of Babel: The Builders, Hubris and Confusion, Shinar",
      "Esau Selling His Birthright: Esau and Jacob, Impulsiveness vs Value, The Family Tent",
      "The Golden Calf: The Israelites, Idolatry and Recklessness, The Base of Sinai",
      "Achan’s Hidden Greed: Achan, Deception, The Tent at Gilgal",
      "Delilah Betraying Samson: Delilah, Treachery, The Valley of Sorek",
      "Nabal’s Harshness: Nabal and David’s Men, Greed and Cruelty, Carmel",
      "Jezebel’s False Accusation: Jezebel and Naboth, Injustice and Murder, Jezreel",
      "The Rich Man and Lazarus: The Rich Man, Indifference, The Gates of the Mansion",
      "Judas’s Thirty Pieces of Silver: Judas, Betrayal and Regret, The Temple Court",
      "Herod’s Vain Pride: Herod Agrippa, Arrogance, Caesarea",
      "Ananias and Sapphira’s Deceit: Ananias and Sapphira, Hypocrisy, The Early Church",
      "Simon the Sorcerer Trying to Buy Power: Simon Magus, Corruption, Samaria",
      "The Pharisee and the Tax Collector: The Pharisee, Self-Righteousness, The Temple",
      "The Parable of the Unforgiving Servant: The Servant, Hard-heartedness, The King’s Court",
      "The Money Changers in the Temple: The Merchants, Commercialism of Holy Space, Jerusalem",
      "The Worship of the Beast: The Deceived, Spiritual Blindness, The Earth",
      "The Fall of Babylon the Great: The Merchants, Mourning over Materialism, The Seacoast",
      "The Victory over Death: The Lamb, Ultimate Triumph, The Cosmos",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }

  export function epic_nature_landscapes(style: Style): Instruction {
    const title = "epic nature landscapes";
    const name = "epic_nature_landscapes";

    const description = `
    - pure wilderness, vast scale, breathtaking geological formations.
    - strictly no people, no buildings, and no man-made objects.
    - focus on atmospheric depth, volumetric lighting, and natural grandeur.
    - elements include cascading waterfalls, jagged peaks, ancient forests, and cosmic skies.
    - high contrast between light and shadow, dramatic weather patterns.
    - never include any signature, words, or watermark.
    `;

    const scenes = [
      "Crystalline Glaciers: Shimmering ice, deep blue crevasses, Arctic light",
      "Basalt Pillars: Hexagonal cliffs, crashing obsidian waves, stormy mist",
      "Redwood Cathedral: Towering ancient trees, sunbeams, mossy floor",
      "Volcanic Veins: Glowing lava flows, obsidian plains, ash-filled sky",
      "Floating Archipelagos: Mist-covered islands, hanging vines, hidden lagoons",
      "The Mirror Lake: Perfect reflection of snow-capped peaks, stillness, dawn light",
      "The Desert Sentinels: Massive sandstone monoliths, swirling dust, orange sunset",
      "The Hidden Grotto: Bioluminescent ferns, crystal clear pool, underground waterfall",
      "The Storm’s Edge: Purple lightning striking a lonely cliff, churning dark ocean",
      "The Autumn Canyon: Fiery maple trees, deep river gorge, golden morning mist",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }

  export function surreal_fractals(style: Style): Instruction {
    const title = "surreal fractal mandala patterns";
    const name = "surreal_fractals";

    const description = `
    - intricate geometry, infinite recursion, psychedelic symmetry.
    - blend of organic shapes and mathematical precision.
    - focus on kaleidoscopic colors, iridescent textures, and glowing edges.
    - evokes a sense of meditation, cosmic order, and the microscopic/macroscopic.
    - background is often a deep void or a nebula to make the patterns pop.
    - never include any signature, words, or watermark.
    `;

    const scenes = [
      "The Golden Ratio Nautilus: Iridescent spiral, fractal chambers, ocean abyss",
      "Bio-Mechanical Mandala: Clockwork gears, vine-like wires, glowing pulses",
      "Celestial Geometry: Star-mapped circles, silver ley lines, violet nebula",
      "Crystal Bloom: Fracturing quartz, growing geometric petals, prismatic light",
      "Neural Network Fractal: Electric synapses, branching patterns, golden sparks",
      "The Glass Labyrinth: Infinite transparent corridors, refracting rainbows, geometric sky",
      "The Fibonacci Forest: Spiraling tree trunks, fractal leaves, golden ratio sunlight",
      "The Clockwork Cosmos: Interlocking celestial gears, brass planets, velvet void",
      "The Liquid Mandala: Pulsing ripples of mercury, symmetrical splashes, neon glow",
      "The Fractal Hive: Hexagonal golden chambers, repeating honeycombs, amber light",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }

  export function abstract_expressions(style: Style): Instruction {
    const title = "raw abstract expressionism";
    const name = "abstract_expressions";

    const description = `
    - focus on texture, emotion, and motion rather than form.
    - thick impasto, paint splatters, flowing ink, and blurred gradients.
    - highly symbolic use of color to represent internal states.
    - non-representational; should feel like an explosion of feeling.
    - visible brushstrokes and "happy accidents" in the composition.
    - never include any signature, words, or watermark.
    `;

    const scenes = [
      "Rage: Crimson slashes, charcoal smudges, aggressive thick textures",
      "Serenity: Ethereal turquoise washes, floating white flecks, soft edges",
      "Confusion: Tangled gold threads, overlapping grey shadows, chaotic depth",
      "Melancholy: Deep indigo bleeds, vertical rain-like streaks, muted silver",
      "Ecstasy: Radiant yellow bursts, circular motion, vibrant orange splatters",
      "Isolation: A single white vertical line on a textured black canvas, cracked paint",
      "Optimism: Interweaving ribbons of gold and sky blue, energetic upward movement",
      "The Void: Overlapping layers of charcoal and soot, deep textural shadows, obsidian",
      "Genesis: A central explosion of primary colors, blurred edges, white light center",
      "Rhythm: Repeating staccato marks of emerald and violet, dancing visual vibration",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }

  export function universal_archetypes(style: Style): Instruction {
    const title = "universal christian human archetypes";
    const name = "universal_archetypes";

    const description = `
    - iconic, statuesque figures representing fundamental human roles.
    - dramatic lighting (chiaroscuro) to emphasize character weight.
    - symbolic props (crowns, mirrors, lanterns, masks).
    - environments are minimal or theatrical to keep focus on the figure.
    - the figure embodies the "essence" of the role, appearing timeless.
    - never include any signature, words, or watermark.
    `;

    const scenes = [
      "The Sovereign: Golden crown, heavy velvet robes, throne of stone",
      "The Magician: Staff of light, swirling smoke, cosmic book of secrets",
      "The Shadow: Dark hooded figure, mirror reflecting a void, misty woods",
      "The Nurturer: Flowing white garments, cradling a glowing seed, lush garden",
      "The Trickster: Two-faced mask, colorful tattered silks, playing cards in wind",
      "The Hermit: Lone figure with a lantern, snowy mountain peak, starry silence",
      "The Lover: Two silhouettes becoming one, a garden of blooming roses, moonlight",
      "The Rebel: A figure breaking iron chains, a background of fire and smoke",
      "The Explorer: A wanderer with a compass, looking over an endless horizon",
      "The Innocent: A child standing in a field of white lilies, pure midday sun",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }

  export function jungian_psychology(style: Style): Instruction {
    const title = "jungian psychological landscapes";
    const name = "jungian_psychology";

    const description = `
    - visualization of the collective unconscious and the process of individuation.
    - themes of mirrors, shadows, caves, and labyrinths.
    - balance of opposites: light vs dark, masculine vs feminine, order vs chaos.
    - surreal and dream-like logic; things merging into one another.
    - symbols like the ouroboros, the spiral, and the deep ocean.
    - never include any signature, words, or watermark.
    `;

    const scenes = [
      "The Ego and the Id: A man looking into a mirror, seeing a beast within",
      "Individuation: A traveler standing at the center of a cosmic labyrinth",
      "The Collective Unconscious: An infinite library submerged in dark water",
      "Anima and Animus: Two celestial spirits merging into a single flame",
      "The Persona: A hallway of hanging porcelain masks, sunlit and eerie",
      "The Mirror of the Soul: A woman touching a liquid mirror, ripples of light",
      "The Tree of Self: Roots digging into skulls, branches reaching for galaxies",
      "The Shadow's Dance: A silhouette dancing with its own detached shadow, twilight",
      "The Archetypal Library: Stone shelves extending into infinity, dusty light beams",
      "The Alchemical Marriage: Red and white liquids mixing in a glass vessel, steam",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }

  export function dramatic_everyday(style: Style): Instruction {
    const title = "dramatic and emotional everyday life";
    const name = "dramatic_everyday";

    const description = `
    - tragedy, love, war, suffering, redemption
    - ordinary moments elevated by extreme cinematic lighting and mood.
    - focus on the "quiet epic": heavy rain, golden hour, or harsh streetlights.
    - deep emotional resonance in simple acts (waiting, walking, looking).
    - high detail on surfaces: wet pavement, steam from a cup, dust motes.
    - moody, noir, or nostalgic color palettes.
    - never include any signature, words, or watermark.
    `;

    const scenes = [
      "The Hero: A man saving someone elses life",
      "The Savior: A sacrificing himself for others",
      "The Departure: A single suitcase on a rainy train platform, neon lights",
      "The Writer: A desk cluttered with papers, one candle, heavy shadows",
      "The Reunion: Two silhouettes embracing under a flickering streetlamp",
      "The Last Cup: Steam rising from coffee in a sun-drenched empty diner",
      "The Journey: A lone car driving into a massive approaching thunderstorm",
      "The Final Letter: An open envelope on a wooden floor, a single ray of light",
      "The Midnight Shift: A lonely gas station in the fog, flickering fluorescent sign",
      "The Storm Watch: An old man at a window, reflection of lightning in the glass",
      "The Empty Stage: A single spotlight on a microphone, dust motes in the air",
      "The First Step: A toddler's foot hovering over a sunlit carpet, dramatic tension",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }

  export function myths_and_legends(style: Style): Instruction {
    const name = "myths_and_legends";
    const title = "world myths and ancient legends";

    const description = `
    - heroic scale, mythological creatures, and divine intervention.
    - epic storytelling through visual composition.
    - focus on power, sacrifice, and the supernatural.
    - cultural motifs from Greek, Norse, Egyptian, and Eastern mythos.
    - vibrant, glowing elements contrasted with ancient stone and dust.
    - never include any signature, words, or watermark.
    `;

    const scenes = [
      "Icarus Falling: Wax wings melting, golden sun, turquoise Aegean sea",
      "The Phoenix Rise: Fire bird emerging from glowing ash, volcanic peak",
      "Yggdrasil: The world tree with glowing roots, stars in the branches",
      "The Sphinx’s Riddle: Sandy desert, massive stone paws, sunset shadows",
      "Valkyrie Flight: Armored maidens on winged horses, aurora borealis sky",
      "The Forge of Hephaestus: Glowing hammer, sparks like stars, subterranean fire",
      "The Song of the Siren: Jagged rocks, crashing waves, a ghostly feminine mist",
      "The Labors of Hercules: A silhouette wrestling a lion, golden pelt, Greek temple",
      "The Descent of Inanna: Seven gates of the underworld, lapis lazuli, dark void",
      "The Sword in the Stone: A shaft of light hitting a hilt, ancient forest, mossy rock",
    ];

    return {
      name,
      prompt: StylePrompt.system({ style, title, description, scenes }),
    };
  }
}
