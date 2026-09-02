"""Generate a realistic sample events.json (for UI testing only; not shipped)."""
import json, random, datetime as dt, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import scraper
random.seed(7)
real = [
 ("Critters","Hilton 202","Video Room",90,"Alien creatures terrorize a small town while bounty hunters chase them. A blend of Horror, Comedy, and Sci-Fi mayhem.",[]),
 ("The Boroughs: Heroes Have No Age","Marriott M301","American Sci-fi and Fantasy Media",60,"Set in a retirement community where time itself becomes the ultimate enemy, The Boroughs offered a fresh take on Science Fiction & Horror. Additional Panelists: Anthony Liggins, Beth Verant(Moderator), Christine Taylor-Butler, Nick Frutiger",[]),
 ("Pluribus: A Perfect World?","Marriott M302-M303","American Sci-fi and Fantasy Media",60,"A world where becoming part of something greater may be the ultimate reward...or the end.",[("Moderator","Kevin Bachelder"),("Speaker","Jane Doe")]),
 ("Photo Session: Eugene Cordero Solo","Marriott International Hall South","Epic Photos",10,"Marriott-International Hall South",[("Speaker","Eugene Cordero")]),
 ("Making a Living Off of Being Creative!","Streaming STRM_TWITCH https://www.twitch.tv/dcdigitalmedia","Digital Media",60,"Whether you're a podcaster, streamer, artist, or writer, it isn't easy making a living from your creative passions.",[]),
 ("Command Zone Package","Mart Building 3, Floor 1","Collectible Card Games",270,"Command Zone Play Area access all weekend. Swag: Playmat, Dice Bag, Life Counter, Booster Pack, Promo, Pin.",[]),
 ("Gaming with Science","Westin Augusta 1-2","Table Top Gaming",60,"There has been an explosion of board games that take Science seriously. Join the hosts of the Gaming with Science podcast! Additional Panelists: Brian Kvito, James Wallace(Moderator)",[]),
 ("Dragon Con Newbie Walking Tours","Hyatt Concourse","Dragon Con Newbies",60,"Meet at the Hyatt and walk the five hotels with a veteran.",[("Moderator","Kevin Bachelder")]),
 ("Drum Circle","Hardy Ivy Structure","Live Performances",180,"Bring a drum. Or don't. Just come.",[]),
 ("MCU: Doomsday Incoming? But What Does It MEAN?","Hilton Galleria 8","American Sci-fi and Fantasy Media",60,"Speculation, wild theories, and some actual evidence about where the MCU goes next.",[]),
 ("The Boys guests: Behind the Mayhem","Marriott Atrium Ballroom","American Sci-fi and Fantasy Media",60,"Cast members discuss the final season.",[("Speaker","Karl Urban"),("Speaker","Chace Crawford"),("Moderator","Host Person")]),
 ("Onesie Wednesday","Courtland Grand Capitol Ballroom","Late Night",120,"Wear a onesie. Dance. Regret nothing.",[]),
 ("Artemis: Bridge Crew Open Play","Westin 12th Floor","Artemis Spaceship Bridge Simulator",120,"Crew a starship bridge with strangers who will become friends by the second Klingon.",[]),
 ("Writing Villains Readers Love to Hate","Hyatt Centennial II-IV","Writer's Track",60,"How to write an antagonist with real motives. Additional Panelists: Gail Z. Martin(Moderator), K.D. Edwards, Keith R. A. DeCandido",[]),
 ("Late Night Puppet Slam","Hilton Salon","Puppetry",90,"Adults-only puppetry. 18+ only, ID required.",[]),
]
tracks_extra = ["Horror","Anime/Manga","Costuming","Kids Track","High Fantasy","Film Track","Space","Science","Skeptics","Star Wars","Star Trek","Whedon","Board Games","Role-Playing Games (Campaign)","Miniatures Games","Video Gaming","Alternate and Historical Fiction","Comics and Pop Art","BritTrack","XTrack","Young Adult Literature","Urban Fantasy","Apocalypse Rising","Electronic Frontiers Forum","Fantasy Literature","Filk Music","Diversity Track","Robotics & Maker"]
rooms = ["Hilton 209-211","Hilton 313-314","Hilton 212-214","Hyatt Grand Hall C","Hyatt Roswell","Hyatt Centennial I","Marriott A601-A602","Marriott A703","Marriott A707","Marriott M303-M304","Westin Chastain F","Westin Augusta 3","Courtland Grand Atlanta 3-4","Courtland Grand Capitol Ballroom","Mart Building 3, Floor 2","Mart2 Vendor Hall Floor 3 Aethon Books booth 3500","Hilton Steps B"]
def hotel(loc):
    f=loc.split(" ")[0].lower().rstrip("0123456789")
    for p,h in [("marriott","Marriott"),("hyatt","Hyatt"),("hilton","Hilton"),("courtland","Courtland Grand"),("westin","Westin"),("mart","AmericasMart"),("hardy","Hardy Ivy Park"),("streaming","Streaming")]:
        if f.startswith(p):
            room = loc if h=="AmericasMart" else loc[len(loc.split(" ")[0]):].strip()
            return h, room
    return "Other", loc
events=[]; n=0
def add(day, hh, mm, title, loc, track, dur, desc, spk, kind):
    global n; n+=1
    start=dt.datetime(2026,9,day,hh,mm); end=start+dt.timedelta(minutes=dur)
    h,r=hotel(loc)
    speakers=[{"name":s[1],"role":s[0]} for s in spk]
    if not speakers and "Additional Panelists:" in desc:
        for raw in desc.split("Additional Panelists:")[1].split(","):
            raw=raw.strip(); role="Panelist"
            if "(Moderator)" in raw: role="Moderator"; raw=raw.replace("(Moderator)","").strip()
            speakers.append({"name":raw,"role":role})
    events.append({"id":f"s{n:04d}","type":kind,"title":title,"day":start.strftime("%Y-%m-%d"),"start":start.strftime("%Y-%m-%dT%H:%M"),"end":end.strftime("%Y-%m-%dT%H:%M"),"duration_min":dur,"location":loc,"hotel":h,"room":r,"description":desc,"tracks":[track],"track":track,"speakers":speakers,"cancelled":False})
for day, count in [(2,6),(3,60),(4,150),(5,160),(6,150),(7,60)]:
    for i in range(count):
        base=random.choice(real)
        title,loc,track,dur,desc,spk=base
        if random.random()<0.6:
            title=random.choice(["Deep Dive: ","Fan Panel: ","Q&A: ","Workshop: ","Screening: ","Open Play: ",""])+random.choice(["The Expanse","Andor","Dune","Discworld","Cyberpunk","Cosplay Armor 101","Foundation","Severance","Sandman","Fallout","Alien","Trek Ships","Gundam","Warhammer 40K","Pathfinder","Magic: Commander"])+" "+random.choice(["Live","Uncut","Panel","Roundtable","2026","Retrospective",""])
            loc=random.choice(rooms); track=random.choice(tracks_extra); dur=random.choice([60,60,60,90,120,30])
        slot=random.choice([(8,30),(10,0),(11,30),(13,0),(14,30),(16,0),(17,30),(19,0),(20,30),(22,0),(23,30),(0,0),(1,0)])
        kind="gaming" if track in ("Collectible Card Games","Table Top Gaming","Artemis Spaceship Bridge Simulator","Board Games","Role-Playing Games (Campaign)","Miniatures Games","Video Gaming") else "panel"
        add(day, slot[0], slot[1], title.strip(), loc, track, dur, desc, spk, kind)
# Targeted events for search tests (with tags, as the tagger would produce)
def add_tagged(day,hh,mm,title,loc,track,dur,desc,tags,kind="panel"):
    add(day,hh,mm,title,loc,track,dur,desc,[],kind); events[-1]["tags"]=tags
add_tagged(5,20,0,"Georgia Philharmonic: Music from the Movies","Marriott Atrium Ballroom","Live Performances",120,"The Georgia Philharmonic performs film and television scores live.",{"fandoms":[],"kind":"performance","topics":["Music"],"adult":False,"guests":"celebrity"})
add_tagged(4,16,0,"Rick & Morty: Wubba Lubba Dub Dub","Hilton Galleria 8","Animation",60,"Fans dissect the latest season and argue about the best Morty.",{"fandoms":["Rick and Morty"],"kind":"panel","topics":["Animation"],"adult":False,"guests":"fan"})
add_tagged(6,13,0,"Video Game Cosplay Contest","Hyatt Centennial II-IV","Costuming",90,"Costumes from video game characters compete for prizes. Audience votes.",{"fandoms":["Video Games"],"kind":"contest","topics":["Costuming"],"adult":False,"guests":"fan"})
add_tagged(5,14,30,"Ask a NASA Scientist: The Road to Mars","Hilton 209-211","Space",60,"Engineers from JPL talk about the next decade of crewed missions.",{"fandoms":[],"kind":"qa","topics":["Space","Science"],"adult":False,"guests":"celebrity"})
add_tagged(5,23,30,"Late Night Puppet Slam","Hilton Salon","Puppetry",90,"Adults-only puppetry. 18+ only, ID required.",{"fandoms":[],"kind":"performance","topics":["Puppetry","Comedy"],"adult":True,"guests":"creator"})
events, merged, removed = scraper.dedupe(events)
if merged:
    print(f"merged {merged} duplicate groups ({removed} rows) so the fixture matches the scraper")
now=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
json.dump({"generated_at":now,"changed_at":now,"source":"sample","count":len(events),"failures":0,"events":events},open("tests/sample-events.json","w"),ensure_ascii=False,separators=(",",":"))
print(len(events),"sample events")
