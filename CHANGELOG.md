# Changelog

## Unreleased (this fork)

- **Traits for the Social and Intimacy needs:** five more of the traits people gain in a game. Social butterfly
  (comes from coffees and chats together), Loner, Affectionate (comes from hugs, cuddles and kisses with that
  person), Reserved, and Glowing (a day, for both of you, after a welcomed cuddle, kiss or making love). For you,
  a gained trait changes your needs through the same table as the traits chosen at the start (a social butterfly
  misses company 25% sooner and gets 20% more from it; a loner misses it 30% later; affectionate and reserved do
  the same for intimacy), and This world › Needs has "You, lately" to see and set them. For the people of the
  world, a gained trait counts like one read from their card (a social butterfly's own Social need drops faster
  and they go out more). When you try to be close, an affectionate person is more ready, a reserved or heartbroken
  one less, and someone sick, hurt or exhausted is up for a hug at most; the AI is told why. A breakup leaves them
  heartbroken for a week (a divorce: two).
- **The people of the world have needs:** hunger, energy, company, fun and hygiene, moved hour by hour by what their
  day already has them doing (asleep, at work, at home, out), each person a little different. They look after
  themselves, so what shows is the texture of a day: tired after a shift, hungry, bored, lonely. The AI is told how
  the people in the scene are doing ("How they are doing", AI context), the phone shows it on their profile, and the
  engine uses it: someone exhausted is less willing to do what you ask. No AI call. Where people go is still their
  routine. Can be turned off per world (People have needs).
- **Free time with a mind of its own:** in their free time, people now go where they feel like going: somewhere with
  food when hungry, home when worn out, out for fun or company otherwise, with favorite places of their own. The
  choice holds for about three hours. Work, sleep, plans with you, festivals and city events are untouched. The AI is
  told why someone is where they are when there is a reason ("came for something to eat").
- **People meet each other:** family, couples and friends who end up in the same place in their free time keep each
  other company; now and then it is remembered ("Bianca and Marco spent time together at the Beach"), so it reaches
  their memories and the rumors. And their own news stays on their mind for a few days (an engagement, a breakup, a
  promotion): the AI is told, and it changes how willing they are.
- **People take after their character cards:** a card that says outgoing, shy, lazy, athletic, tidy, a foodie, a
  bookworm, a party-goer, a homebody or outdoorsy (in plain words; no AI call) changes how fast that person's needs
  move and which places pull them in their free time.
- **Who you are changes your needs:** traits, habits that became traits and hobby levels now change how fast needs
  drop and how much fills them (a cheerful person keeps their mood longer, an athletic one has more energy, a good
  cook gets more from a home meal, a film lover enjoys the cinema more), and how fast friendships and romance grow
  (charming, kind, shy, romantic). This world → World → Needs lists what your traits are doing. Always between half
  and double; a custom world can bring its own table (`modifiers` in its JSON).
- **A social need, if you want it:** This world → World → Needs → Extra needs (in a Home: the Needs tab). Off by
  default, chosen per game. It drops while you are awake; talking to people, texting, running into friends and a
  drink out fill it; left empty, loneliness wears your mood down.
- **An intimacy need, if you want it:** the same place, off by default, chosen per game (needs romance on in the
  world). With it on, the things to do include being close to who is here: a hug with a friend, cuddling or a kiss
  with a crush, making love with a partner when you are alone at home, or private time alone. They decide for
  themselves, from the game's own numbers (romance, bond, what they think of you, whether they are at work): the AI
  is told whether they welcomed it or turned it down and only narrates that. No AI call. Never with family beyond a
  hug. "Fade to black" (on by default) tells the AI to cut away rather than describe.
- **Friendships can fade:** the same place, off by default. After a week with no contact, a friendship loses a point
  a day, never below an acquaintance; partners keep theirs.
- **World creator › Rooms:** a new tab to give a place rooms inside, or to make a plan of rooms for homes, without
  editing the world file. Pick what to edit, add floors (each with an optional picture of the plan), add rooms and
  drag their boxes into place. A room has a name, a description, tags (the kinds of room things to do can ask
  for), who may go in, what people wear in it, a picture, and one room is the entry. A plan for homes also has
  bedrooms (one person's, a couple's, a guest room, the flat of a duplex) and "Homes with these rooms": every home
  of a kind, or addresses one by one. A kind of home can now name a plan (`homes.kinds.<kind>.interior: "<plan id>"`).
  Maps & places has "Give it rooms inside" and "What people wear here" on a place; Jobs has "In which room";
  Things to do has "Only in rooms tagged"; People has "Their bedroom". Rooms no longer show as pins in the map
  editor, and removing a place removes its rooms.
- **World creator › Traits people gain:** a new tab for the world's own list of the traits people gain and lose in
  a game (name, id, what the AI is told, lasting or passing, what brings it), and which win when several picture
  sets fit. A world without a list keeps the usual one.
- Exported worlds now carry the pictures of floor plans and rooms.
- **Fixed: a busy place narrated as empty.** With nobody you know in a place, the narrator (and the scene prompt)
  said nobody was there, even when the place was busy. Now the AI is told that nobody you know is there but
  strangers are around as background: unnamed, and not speaking to you. An empty or closed place is still empty.
- **Floor plan button:** in a place with rooms, "Floor plan" is now a button beside "Map", and the things to do no
  longer list a row for every room. You go to a room from the plan. A room drawn on no floor still gets a row,
  since the plan cannot reach it.
- **Willow Lane (Porto Alto):** the default world has a new district, Willow Lane, reached from Midtown like Maple
  Heights: 6 homes and 6 public places (school, café, market, pub, community center, park) with 93 rooms on floor
  plans, 15 new people, and day and night pictures for every room, building and floor. It is the first part of a
  built-in world that uses rooms inside places and homes. The district's map picture is a plain layout drawing for
  now, and the rooms of homes are edited in the world file (the world editor has no screen for them yet).
- **Rooms inside homes:** a world file can give homes rooms too (`homes.plans`, named per address by
  `homes.zones[].interiors`, or `interior` on a kind of home). Your home and other people's then have a floor plan
  like a building. Bedrooms are handed to the household (a character can name theirs; a couple's room holds two; a
  guest room stays free). At night people are in their bedrooms, by day in the shared rooms; visitors are in the
  living room. Your own home is open to you; someone's bedroom opens when you are close or together; the private
  rooms of someone else's home stay shut. A duplex gives each flat its own rooms plus the shared ones.
- **Rooms inside places:** a place in the world file can have an `interior` (floors, and rooms that are places of
  their own with `in: <building>`). Arriving puts you in its entry; the other rooms are listed with the things to
  do, and "Floor plan" shows the building with who is in each room. Walking between rooms takes no time. The scene
  holds only the people in your room; staff are in the room their job names (`room` on the occupation), visitors
  keep to the public rooms. Rooms can be `staff`, `private` or `locked`. What you can do follows the room (its tags,
  and `rooms` on an action), and the AI is told the room and who is elsewhere in the building. No built-in world
  has rooms yet; homes do not have them yet.
- **Places that change:** This world → Places. Close a place for a while with a reason (or until you reopen it),
  take it off the map, rename it, or add to how it looks. The change lives in the save; the world file is not
  touched. People stop going to a closed or hidden place, the map and the scene follow, and the AI is told what
  changed here lately and what is closed in town.
- **Traits for people:** the people of the world (and you) can now have traits: lasting ones (party animal,
  athletic, bookworm, foodie, homebody, outdoorsy) and states that pass by themselves (hurt, sick, heartbroken,
  exhausted). A job counts as a trait by itself. Doing a thing with someone on five different days brings its trait
  out in them (working out together → athletic); stop for two weeks and it fades. Add or remove traits by hand, or
  make your own, on their page in People. The AI is told (AI context → Who they are lately). A world file can list
  its own `traits` and a `traitPriority` order.
- **Picture sets for traits:** a character can have extra picture folders for a trait or a combination, named
  `<traits>--<outfit folder>` (`hurt--everyday`, `hurt.party-animal--everyday`, `career-nurse--career`). The set
  covering the most of their current traits shows; an outfit the set lacks falls back to the usual pictures.
- **Photos on the phone:** a new Photos app gathers the pictures of this game (those in the chat and those posted
  on Chirp) by person. Who is in a picture is guessed from who sent it; open a picture to change who is in it, and
  that is kept in the save. Each person's page in People links to their photos.
- **Clothes the game keeps track of:** everyone in the scene, and you, now have a look in the save: a kind of outfit
  (everyday, formal, athletic, sleepwear, party, swimwear, hot weather, cold weather, work) and a layer (with
  outerwear, the outfit, underwear, nothing). The game changes it by itself: sleepwear at home at night, work clothes
  on shift, swimwear at the beach or pool, athletic at the gym, a coat outdoors in winter or rain, light clothes on a
  sunny summer day. Click a sprite → Clothes to set it by hand (it then stays until "As the moment asks"). The AI is
  told what people wear (AI context → Clothes block).
- **Pictures follow the look:** a character with folders named `everyday`, `formal-outer`, `underwear`… in their
  Expressions folder shows the pictures of the look they wear now, falling back to the nearest folder they have. An
  `outfits.json` beside them (written by the card generator) gives the AI the words for each outfit. Characters
  without those folders look as before, and outfits put on the old way are kept.
- **A narrator:** This world → AI context → AI calls. When you arrive somewhere, the narrator describes the place at
  that hour and who is there (one AI call; or a plain line from the game with no call; or nothing). When you do
  something (a shower, cooking, a film), the narrator tells how it goes instead of whichever character happens to be
  in the room, and tells who came in or left while it lasted. "A character who is there answers" keeps the old way.
  If the AI gives no answer, the plain line is used. Not on arrivals from room to room in a Home.
- **Free text in the message box:** Settings → Game → Message box. Keep the Say / Do / Story / See buttons, add a
  Free mode beside them, or hide the buttons and write freely. Free text is sent exactly as written, so one line can
  mix what you say and do. In free text, a line that starts with `>` steers the story and one that starts with `?`
  looks at something.
- **Writing style:** This world → AI context → Writing style. Off by default (the preset decides). On: point of view,
  length, pace, tone, style tags (and your own), how people speak, the narrator's presence and notes become one short
  instruction sent with every reply, late in the prompt. Or send one text of your own, which the AI can write from
  your choices. Styles are kept per game, and can be saved to use in other games.
- **Write it, and the game does it:** in Do or free text, a line such as "I take a quick shower" is matched to the
  thing to do here. Mundi offers to do it (time passes, its effects apply), then sends your own line. Questions, plans
  for later, what you say in quotes and what other people do are left alone. Settings → Game → What you write
  (offer, do it without asking, or never).
- **Expand:** a button in the message box. Write a few words ("shrug, say fine") and the AI writes them out as your
  character's line, which you see and can change before sending. One extra AI call each time.
- **People are not yours to command:** when you ask or tell someone to do something, the AI is told for that one
  reply how willing they are, from the game's own numbers (how close you are, what they think of you, whether they
  are working or it is late, whether it was an order). No AI call. And with every reply, a line says your character
  is one of the people of the world, not its author (AI context → Rules of the scene).
- **Who walks in while you do something:** after a thing to do that takes time, the AI is told who came in or left
  meanwhile, so the narration has them arrive.
- **A question waiting for its answer** (asking someone out, proposing) no longer gives up early when another
  extension makes background AI calls: only real replies in the chat count as turns.

## 0.2.1 · 2026-10-28

Fixes and improvements for Home mode.

### Security

Thanks to **coldasblues**, whose fork found these.

- **World files can no longer run code.** Picture addresses, numbers and colors from a world file (yours or one
  you imported) went into the page's styles as they were, and a crafted file could run code inside SillyTavern.
  Now a picture can only be a picture, numbers stay numbers and colors stay colors, and everything Mundi draws
  is cleaned of anything that could run code.
- **Slash commands:** text sent through SillyTavern's commands (lines, narration, read aloud, pictures) can no
  longer carry an STscript `{: … :}` block.
- **Importing a world** only uses the pictures inside the file: nothing is downloaded from other sites.
- **Messages can't press Mundi's buttons:** a reply (or a card, or a shared chat) with HTML that copied Mundi's
  controls could make a click do something in Mundi. Those controls are now removed from what messages show.
- **Pictures from links in messages** now follow SillyTavern's "Forbid external media" (a picture from another
  site tells that site you are reading). To show them anyway: Chat look → Show pictures from links.
- **Every attribute filled from a world, a card or a save is escaped**, also in the world creator's fields, and a
  currency symbol or an icon can't carry HTML.

### Visitors (Home)

- **Invite people over** from the Calendar (a new Visits tab). They arrive about an hour later and stay until
  you say goodbye.
- **The doorbell:** when they arrive, it rings. Open the door yourself, or someone else answers after a while.
  If you are out, they are let in.
- **Where they sleep:** a free bedroom, your room or a housemate's room, chosen for each guest (and changeable
  while they stay).
- **Guests' rooms** are always open to you, and saying goodbye in their room no longer leaves you in the dark.

### Parties and going out

- **Guests from outside:** a party can invite people who don't live in the house. They come at the start and go
  home at the end, unless you ask them to stay after the party.
- **A party out of the house:** pick the place and its background.
- **Edit the guests** of a planned party on its card (Edit guests), next to Call it off.
- **Go out** with anyone from your cast or your library, and pick the background. A date "somewhere out" can
  have its own background too.
- **Sleeping through plans:** going to sleep when a party or a date is coming asks first. "Sleep until the
  party" (or the date) wakes you up just in time.

### Looks and sound

- **The AI narrates what you do right away** (Things to do, in a scene). On by default.
- **AI calls in one place:** This world → AI context lists everything that makes Mundi call the AI (narrating what
  you do, the diary, characters' texts, Chirp posts and pictures), each with its own switch. New: characters' texts
  can use short ready-made replies instead of the AI.
- **Rain and storm sounds**, with their own switch and volume (Settings → Weather sounds).
- **Cards layout:** sprites on the left or the right.
- **Visual novel:** the dialog box on the left, with an adjustable width.
- **Backgrounds** fade into each other when you move.
- **Character picker:** folders keep their color.

### Home

- **This Home** comes first in the menu and holds the Home settings.
- **Company stays:** someone who comes along with you stays until you part (no timer), and can go to your room
  with you.
- **More kinds of family ties.**
- **Bedroom doors:** someone's room when they're not in is locked (no more ringing a doorbell inside the house); when
  they're in, you knock.
- **The menu** no longer repeats "Go to my room" and "Go out" (they're on the top bar).
- **What you can do fits the room:** eating and drinking in the kitchen (everything) and the dining room (a meal, a
  coffee, a drink, a snack); the TV and the new **Play video games** in the living room; washing up (a shower, the
  new **Brush your teeth**) in the bathrooms. Rooms you set up yourself in the Home creator keep your choice.
- **Things to do in each room:** swim, sunbathe or relax by the pool; do the laundry; tinker or wash the car in the
  garage; sit on the porch or water the plants; tidy up the storage room; set the table; read in bed. Working out
  (the treadmill too) is in the gym.
  Your own Homes get the same: a room called "Piscina", "Garage", "Banheiro"… gets the actions of that kind of room
  (by its name, in English, Portuguese or Spanish).
- **Homes you made before** are brought up to date when they open: they get the actions added since and lose built-in
  ones that no longer exist. Actions you made yourself are never touched, and one you remove stays removed.
- **Go out** from the garage and the entrance too, not only from the floor plan.
- **Go somewhere else:** when you are out, go on to another place (the cinema, then the mall, then a restaurant…)
  with its own name and background; who is with you comes along.
- **Running into someone:** stopping to talk no longer makes them follow you. They stay where you met for a while.
- **New pictures** for Stella and Seraphina in the tour.
- **Needs, if you want them:** This Home → Needs turns on hunger, thirst, mood and hygiene for this game (off by
  default). Their icons show under the clock, they drop with time, and the AI is told when one is low. No energy, and
  nothing bad happens when one runs out.
- **The Advanced switch** at the top of This Home is easier to see.

### First steps, tour and gallery

- **Choose your language first:** the first time Mundi opens, before Stella shows up, a window asks only for the
  language (English, Português (Brasil), Español). The welcome and the tour then come in that language.
- **Stella's tour box** stays in the same place and the same size on every step, so the buttons (Skip tour, back,
  Next) never move. The text is bigger, the step count sits next to the buttons, and Stella is shown whole from the
  waist up, standing on the box's bottom line.
- **Gallery:** two tabs, **Saves** and **Character greetings**. Saves are one grid, newest first, with the game's
  name under each album (before, every game had its own row, so it looked like a list).
- **Settings → Game → What's new** opens this version's changelog instead of the tour.
- **The Old Manor** has a cover picture.

### Fixes

- **Playful slaps and teasing** no longer cost bond: a harsh line only counts if the character takes it badly (the
  emotion of their reply, or, without the Expressions extension, the words of it: they laugh, or they pull away in
  tears). Said with a grin, "de leve", "playfully"… it doesn't count at all.
- **Family and ties:** someone added later as your spouse (or fiancé, or partner) shows as Married (Engaged,
  Dating) and is no longer a stranger. Before, this only worked when set while creating the game.
- **Rooms off the floor plan:** a guest sleeping in a shared room no longer creates a room that isn't on the plan.
- **Scene background:** the floor plan no longer gets stuck in the background after you move.
- **The phone** no longer slides in again when a dialog opens.
- **Exporting a world** now takes along the backgrounds you picked from your own SillyTavern (My backgrounds),
  so the person who imports it sees them too.

## 0.2.0 · 2026-10-25

Everything since 0.1.0 (the last version on GitHub, commit `33837e1`).

### Highlights

- **Home**, a new way to play: one house, the characters you choose, and pure role-play.
- **Porto Alto**:
  - a picture for every place;
  - three kinds of apartments and houses;
  - a new gym and a new cinema.
- **A living world**: people with full days, places that get busy and quiet, day and night, and news from the
  lives of the people you know.
- **The interface in Português (Brasil) and Español.**
- **Save safety**: migrations, automatic backups and branches.
- **The RPG mode and the medieval style** are built but locked ("Soon") while they get finished.

### Home mode (new)

- **What a Home is:** a house and the characters who live in it, with no work, money or bills. Life outside
  happens off-screen.
- **Two ready Homes:**
  - The Shared House (modern, three floors, ten bedrooms, a new Entrance);
  - The Old Manor (medieval, locked for now).
- **The Home creator:**
  - premise;
  - rooms;
  - bedrooms;
  - cover picture, which can also be one of the room pictures.
- **New game in a Home:**
  - choose the rooms the house has;
  - choose what can be done in each room;
  - add rooms of your own;
  - write your situation, or let your AI write the premise from lorebooks.
- **Floor plan (optional):**
  - one picture per floor, with day, afternoon and night versions;
  - each room drawn as a box: drag to move, drag the corner to resize;
  - floor buttons with the faces of who is on each floor;
  - a red "!" marks rooms not on the plan;
  - without a plan picture, the room pictures are grouped by floor.
- **Time:**
  - the clock moves a few minutes with each message (can be turned off);
  - click the clock to let time pass;
  - sleeping brings you back to where you went to bed.
- **Go out:**
  - write where you are going, pick who comes and a background;
  - the scene out there is free, like a chat;
  - **Back home** asks first.
- **Who lives here:**
  - change bedrooms (two people in one bedroom share it, and the AI knows);
  - someone can move in or move out during the game, with a confirmation.
- **Dress code per room:** an outfit folder from the character's Expressions (swimsuit at the pool, pajamas in
  the bedrooms…). The AI is told what people wear.
- **Housemates:**
  - can go out for a while, or stay in;
  - each can have a job written in your own words, with a shift.
- **House party:** free; everyone leaves their rooms for the common areas.
- **This Home settings:**
  - Bedrooms, Home and Dress code;
  - a new **The house** tab: rooms on or off, what can be done in each, your own rooms, and the floor plan (for
    Homes you made).
- **Difficulty** in a Home changes how fast bonds grow.
- **One long conversation:** moving between rooms or going out no longer hides what was just said from the AI.
  Only sleeping starts a new day.
- **Bathrooms and shower rooms** no longer offer snacks or drinks.
- **Liquid-glass windows:** Let time pass, Go out, Back home, Who lives here and the pickers.

### Porto Alto

- **Pictures:** a background for every place (45) and for six kinds of home:
  - small apartment, apartment, penthouse;
  - small house, house, villa.
- **New places:**
  - **Palm Coast Gym**, apart from the **Stadium**;
  - **Cineplex** in Midtown ("Watch a movie" moved there).
- **The elevator ride** when arriving at an apartment was removed.
- **Map cards:** a place with a long card (many jobs) now shows it beside the pin, so the pin can still be clicked.
- **The HUD on maps:** the clock, the place name and the map tabs never overlap, at any HUD size.

### Life in the world

- **Day and night:**
  - opening hours;
  - prices and the mood of the streets by part of the day;
  - a picture per part of the day for places, homes and maps.
- **Regions:** each has a crowd level, a public mood, tension, weather and prices that drift day by day.
- **People's days:**
  - routines get interrupted (sick at home, errands, working late);
  - places remember regulars;
  - over the weeks, couples get engaged, marry or break up, and people get promoted.
- **Things that come to you:**
  - neighbors knocking;
  - friends asking your advice;
  - news of birthdays, promotions and weddings.
- **City events** (shows, matches, fairs, open mic) and **festivals**, in the calendar.
- **Hobbies** that level up: some jobs ask for a level, and it raises what they pay.
- **Habits that become traits** (Early riser…), and fade when you stop.
- **Other systems** (each can be turned on or off per world in the World creator):
  - reputation per town and secret identities;
  - pets;
  - apprentices;
  - letters from friends in other towns;
  - schools with exams and clubs;
  - factions and guilds;
  - the realm and its gods;
  - trade and smuggling;
  - property, businesses, a garden and loans;
  - taxes;
  - crime and prison;
  - celestial events.
- **The AI context:** a token budget, with the least important blocks dropped first. Each block's text can be
  edited, and you can add your own instructions.

### Characters, scene and chat

- **Sprites:**
  - overlap like a stage, and whoever spoke last stands in front;
  - click a sprite for a radial menu with actions and outfits.
- **Outfits:** subfolders of a character's Expressions (pajamas, swimsuit…).
- **Persona:**
  - switch persona in a chat or a Home, optionally renaming your earlier lines;
  - **Play as** in a World now has **Use another persona** too.
- **Chat look:**
  - visual novel, Classic or Cards;
  - sizes and colors with transparency;
  - colors from a SillyTavern theme;
  - presets (Midnight Glass, Rose Dusk, Forest Calm, and your own, saved as SillyTavern themes).
- **Images:**
  - pictures in messages, with a lightbox;
  - an Image Generation button;
  - TTS and Speech Recognition support (Settings → Add-ons).
- **Background pickers:** two sources, **My backgrounds** (SillyTavern's) and **Mundi** (the pictures of Mundi's
  worlds).

### Library

- **Folders** for characters, personas and lorebooks:
  - drag cards into folders (they move, nothing is copied);
  - rename, color, sort and export a folder as a zip.
- **Sorting:** by name, date, last chat, tokens or entries. Folders follow the same order.
- **Characters:**
  - alternate greetings;
  - tags;
  - expressions and outfits;
  - export as PNG or JSON;
  - the saves they are in.
- **People presets:** a group of characters with their households and relations, usable in any world.

### World creator

- **More tabs:**
  - Words (lexicon);
  - Character creation;
  - Customs & calendar;
  - Realm & factions;
  - Economy & skies;
  - RPG (locked).
- **Setup:** systems on or off, game modes, style and skin.
- **Maps:** per-period pictures, opening hours, crowd and region mood.
- **Homes:**
  - expenses (water, power, firewood…);
  - things that break at home;
  - the house maps editor for Homes.
- **New world:** start from a ready world or from nothing; the name field is highlighted if it is missing.

### Saves

- **Migrations** keep old saves working.
- **Automatic backups** (the last 3) before a migration or a repair; restore them in Settings → Game.
- **Make a branch:** a copy of the save as it is now.
- **A save from a newer Mundi** opens read-only.
- **A room added to a Home after the game started** is turned on by itself.

### Languages

- **Português (Brasil) and Español**, in Settings → Interface → Language. Only Mundi's own screens are
  translated: the worlds' places and people and the story keep their own language.

### Updates and onboarding

- **What's new:** after an update, a window with what's new, and a short tour by Stella of only the new things.
- **Update notice:** on the main menu, a small note when a newer Mundi is on GitHub, with an Update button.
- **Stella's tour** has a **Home** part. Settings → Game can replay any part, or only what's new.
- **Help** has its own topics in a Home: time and sleep, the house, going out.

### Look and settings

- **Settings tabs:** Game, Sound, Interface, Add-ons.
- **Look:**
  - date and time formats;
  - fonts;
  - theme and secondary colors;
  - skins;
  - separate scales for phones.
- **Background music:** menu, world and home, with crossfades.
- **Main menu:** a map behind it, and the real version in the footer.
- **World cards** show only the cover (no slideshow).

### Locked for a later update

- **The RPG mode:**
  - character sheet, classes, magic, quests;
  - combat (tactical or narrative), party and sellswords;
  - journeys, towers, contracts, crafting, artifacts, legends.

  Worlds made for it, like **Nova Vega**, show "Soon".
- **The medieval style:**
  - **Valdoria** in Life-Sim, with the journal in place of a phone: letters, a market of pinned notes, a medieval
    almanac, lodgings by town;
  - **The Old Manor** Home.

  They show "Soon · Medieval".
