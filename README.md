[<img src="http://developers.overwolf.com/wp-content/uploads/2017/09/overwolf-appstore-badge.png">](https://www.overwolf.com/app/sebastien_tromp-hs_collection_companion)

# What is Firestone?

Firestone is an app you run on Overwolf alongside Hearthstone (like HearthArena).

It monitors the packs you open and tells you if the cards you receive are new cards or are just dust because you already have the maximum number of copies of the card. It also gives you an overview of how far along to completing each set you are, as well as details on cards (you can play the sounds they make in-game directly from the collection window);

The long-term goal is to provide other features needed by players who want to manage their collection (such as stats, missing cards, etc.), as well as an achievements system and deck tracker.

Please don't hesitate to request new features or report issues using the issues link above.

PS: images come from HearthHead

# Features

* In-game notifications whenever you receive new or duplicate cards
* Pity timer for each set
* In-game collection manager
* See all the details of any cards (including the sounds it makes in game)

# Screenshots

See the full [imgur album](https://imgur.com/a/hLz4ORp)

# Contributing

```
$ git clone ...
$ cd your_repo
$ cd Files
$ npm install  # You might need to have node installed
# Then go into node_modules/angular2-indexeddb and remove all the .ts files (there are 4-5 of them)
# Clone ZeroToHeroes/ng-select and install this version locally and copy it to node_modules (hopefully not for long)
# Same for ZeroToHeroes/angular2-notifications and install this version locally and copy it to node_modules (hopefully not for long)
$ npm run dev # For development
$ npm run build # For release
```
