# About
rmIncomingDups is a Thunderbird extension which allows you to configure rules  
how incoming emails should be treated that are similar/identical to other  
already present messages (saved in folders on other email accounts). If they are  
considered identical then an action on the incoming message will be performed  
(mark read,move,delete,delete permanent).

# Features  
* actions: mark read, move to trash, delete, delete permanent
* matching identical messages: messageID, author, subject, time, body, size, line number,...

# Requirements

Software:  
- a recent version of the mailing client Thunderbird

# Installation and First Steps

* Clone this repository:  
    git clone https://github.com/philsmd/rmIncomingDups.git  
* Install:   
    cd rmIncomingDups.git  
    + make    # or simply zip the whole content of the current folder and rename it to rmIncomingDups.xpi  
    + open thunderbird  
    + install add-on (Tools - Add-ons - Install Add-on From File...)  
    + add toolbox icon (optional, View - Toolbars - Customize...)
    + setup your rules (add accounts to a rule)
    + relax AND/OR contribute

# Hacking

* think if it would be better and necessary to use account IDs instead of account names (e.g. if one would like to rename an account)  
* if yes, help to implement it (easy!)  
* translations
* testing and new features
* and,and,and  

# Credits and Contributors 
  
Contributors WANTED  
(also "only" for translations)

Credits go to: philsmd

# License

The Source Code in this project is subject to the terms of the Mozilla Public License, v. 2.0
