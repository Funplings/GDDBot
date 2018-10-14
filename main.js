/*
TODO:
add user's name to decal commands
poll weekly when people are free to play games
be able to edit/send/delete bot messages by id/channel_id
edit existing polls
*/

/*** Global Variables ***/

// reqs
const fs = require('fs')
const sleep = require('system-sleep')
const { Client, DMChannel, RichEmbed } = require('discord.js')
const { google } = require('googleapis')

// google api
const TOKEN_PATH = 'gapi_token.json'
// discord
const token = fs.readFileSync('token').toString()
const client = new Client()

// constants
const NUM_EMOJIS = [':zero:', ':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:']
const VOTE_OPTIONS = [':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:', ':zero:']
const VOTE_EMOJIS = ['\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3', '\u0034\u20E3', '\u0035\u20E3',  '\u0036\u20E3', '\u0037\u20E3', '\u0038\u20E3', '\u0039\u20E3', '\u0030\u20E3']
const LIGHT_BLUE = 0xADD8E6
const RED = 0xFF0000

const GUILD_IDS = ['433080296057864192', '317420684689276928']
const ADMIN_IDS = ['313850299838365698']
const MANAGEMENT_CATEGORY_IDS = ['433105370962198530', '494362107417198592']

// labs checkoff spreadsheet
const LAB_ID = '1O4KiEgQ82M8jNRJBbDZgC-bIXC_yiCx5Qzh6EC4JGkk'
const LAB_SKIP_HEADERS = 2  // number of headers in checkoff sheet to ignore when searching lab name
// project grading spreadsheet
const PROJECT_ID = '10p_IHZ8la9LfLOhzxBLrTxgQwJ7Ujh0D-u0M1zUWBkY'
const PROJECT_SKIP_HEADERS = 2  // headers in project sheet to ignore when searching project name
// decal attendance spreadsheet
const ATTENDANCE_ID = '1nQnH-9bT-VyJGFe7ai-Ayhrov_9Zj6WT4uuTLBxMrjc'
const ATTENDANCE_SKIP_HEADERS = 3
const DECAL_MEETINGS = 28   // number of decal meetings there are

/*** Utility Functions ***/

// converts a number into emojis that represent it
function num_to_emoji(num) {
    let str = ''
    while (num >= 1) {
        str = NUM_EMOJIS[num % 10] + str
        num = Math.floor(num / 10)
    }
    return str
}

function is_facilitator(member) {
    return member && member.roles && (member.roles.find("name", "Facilitator") || member.roles.find("name", "Moderator"))
}

function is_management_channel(channel) {
    return MANAGEMENT_CATEGORY_IDS.includes(channel.parentID)
}

function gapi_connect(callback, spreadsheet_id) {
    // initialize google api oAuth2 client
    fs.readFile('gapi_credentials.json', (err, content) => {
        const { client_secret, client_id, redirect_uris } = JSON.parse(content).installed
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
        fs.readFile(TOKEN_PATH, (err, token) => {
            oAuth2Client.setCredentials(JSON.parse(token))
            const sheets = google.sheets({ version: 'v4', auth: oAuth2Client })
            sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheet_id,
                range: 'Sheet1!A:ZZ',
            }, (err, res) => {
                if (err) return console.log('API Error: ' + err)
                const rows = res.data.values
                callback(rows)
            })
        })
    })
}

// returns a role, returning null if not found
function parse_role(message, args) {
    const args_str = args.join(' ')
    if (args_str.match(/^league(?:\s*of\s*legends?)?|lol$/i)) {
        return message.guild.roles.find("name", "League of Legends")
    } else if (args_str.match(/^overwatch|ow$/i)) {
        return message.guild.roles.find("name", "Overwatch")
    } else if (args_str.match(/^civ\s*\d?$/i)) {
        return message.guild.roles.find("name", "Civ")
    } else if (args_str.match(/^tetris$/i)) {
        return message.guild.roles.find("name", "Tetris")
    }
    return null
}

/*** Help Functions ***/

function help_poll(channel) {
    const embed = new RichEmbed()
        .setTitle(':bar_chart: Poll usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('**Yes / No**\n/poll "Boba?"\n**Multi answer (up to 10)**\n/poll "Where?" "UCha" "Asha"')
    channel.send(embed)
}

function help_dice(channel) {
    const embed = new RichEmbed()
        .setTitle(':game_die: Dice usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('**Roll a 6 sided dice**\n/dice\n**Roll a dice with any number of faces**\n/dice 20\n**Roll a number of dice**\n/dice 4d6')
    channel.send(embed)
}

function help_lab_facilitator(channel) {
    const embed = new RichEmbed()
        .setTitle(':white_check_mark: /lab help:')
        .setColor(LIGHT_BLUE)
        .setDescription('List labs: `/lab list`\n'
            + 'Missing >1 lab: `/lab missing`\n'
            + 'Specific student: `/lab <student_name>`\n'
            + 'Specific lab: `/lab <lab_name>`')
    channel.send(embed)
}

function help_role(channel) {
    const embed = new RichEmbed()
        .setTitle(':question: /role usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('**Adding a role**\n/role add <name of game>\n/addrole <name>\n**Removing a role**\n/role remove <name>\n/removerole <name>')
    channel.send(embed)
}

/*** Command (Helper) Functions ***/

function list_labs(message) {
    gapi_connect(rows => {
        const headers = rows[0].slice(LAB_SKIP_HEADERS)
        const embed = new RichEmbed()
            .setTitle(':white_check_mark: Labs:')
            .setColor(LIGHT_BLUE)
            .setDescription(headers.join('\n'))
        message.channel.send(embed)
    }, LAB_ID)
}

function introduce_server(user) {
    const msg = 'This is the Discord server for the Game Design and Development club at Berkeley. '
        + 'If you\'re interested in making games, this is the place for you. We look forward to working with you :smile:\n\n'
        + 'Please read #welcome-and-rules and #apply-for-role.'

    const embed = new RichEmbed()
        .setTitle(':game_die: Welcome to GDD! :bear:')
        .setColor(LIGHT_BLUE)
        .setDescription(msg)
    user.send(embed)
}

function can_only_be_used_in_guild(channel) {
    const embed = new RichEmbed()
        .setTitle(':exclamation: Command error:')
        .setColor(RED)
        .setDescription('Sorry, that command can only be used in the GDD server')
    channel.send(embed)
}

// notifies the channel
function role_not_found(channel) {
    const embed = new RichEmbed()
        .setTitle(':exclamation: Role error:')
        .setColor(RED)
        .setDescription('That role couldn\'t be found')
    channel.send(embed)
}

function student_not_found(author) {
    const embed = new RichEmbed()
        .setTitle(':exclamation: Command error:')
        .setColor(RED)
        .setDescription('This command is for people currently in the decal. '
            + 'If you\'re in the decal but this message is showing, let a facilitator know.')
    author.send(embed)
}

function add_role(message, args) {
    if (!message.guild || !GUILD_IDS.includes(message.guild.id)) {
        can_only_be_used_in_guild(message.channel)
        return
    }
    const role = parse_role(message, args)
    if (!role) {
        role_not_found(message.channel)
        return
    }
    if (message.member.roles.has(role.id)) {
        const embed = new RichEmbed()
            .setTitle(':exclamation: Role error:')
            .setColor(RED)
            .setDescription('You already have that role')
        message.channel.send(embed)
        return
    }
    message.member.addRole(role)
    const embed = new RichEmbed()
        .setTitle(':white_check_mark: Role added')
        .setColor(LIGHT_BLUE)
    message.channel.send(embed)
}

function remove_role(message, args) {
    if (!message.guild || !GUILD_IDS.includes(message.guild.id)) {
        can_only_be_used_in_guild(message.channel)
        return
    }
    const role = parse_role(message, args)
    if (!role) {
        role_not_found(message.channel)
        return
    }
    if (!message.member.roles.has(role.id)) {
        const embed = new RichEmbed()
            .setTitle(':exclamation: Role error:')
            .setColor(RED)
            .setDescription('You don\'t have that role')
        message.channel.send(embed)
        return
    }
    message.member.removeRole(role)
    const embed = new RichEmbed()
        .setTitle(':white_check_mark: Role removed')
        .setColor(LIGHT_BLUE)
    message.channel.send(embed)
}

/*** Client Triggers ***/

client.on('guildMemberAdd', member => {
    if (!member.bot) {
        introduce_server(member)
    }
})

client.on('message', message => {
    if (message.author.bot) {
        return
    }

    let args = message.content.match(/(?:[^\s"“”]+|["“”][^"“”]+["“”])/gi)
    if (!args) {
        return
    }
    args = args.map(x => x.replace(/["“”]/gi, ''))

    if (message.content.startsWith('/') || message.channel instanceof DMChannel) {
        const date = '(' + (new Date(message.createdTimestamp)).toLocaleString('en-US') + ') '
        const content = '[' + message.author.tag + ' in ' + (message.channel.name ? message.channel.name : 'PM') + '] '
            + message.content

        console.log(date + content)
        for (let admin_id of ADMIN_IDS) {
            client.fetchUser(admin_id).then(user => {
                user.send(content)
            }).catch(e => console.log(e))
        }
    }
    if (args[0].match(/^\/poll$/i)) {
        if (args.length === 1 || (args.length === 2 && args[1].match(/^help$/i))) {
            help_poll(message.channel)
        } else if (args.length > 12) {
            const embed = new RichEmbed()
                .setTitle(':exclamation: Poll command error:')
                .setColor(RED)
                .setDescription('Too many answers - max 10')
            message.channel.send(embed)
        } else if (args.length === 2) {
            const query = args[1]
            const embed = new RichEmbed()
                .setTitle(':bar_chart: ' + query)
                .setColor(LIGHT_BLUE)
                .setDescription(':white_check_mark: Yes\n:negative_squared_cross_mark: No')
            message.channel.send(embed).then(message => {
                message.react('✅')
                sleep(500)
                message.react('❎')
            })
        } else {
            const query = args[1]
            const options = args.slice(2)
            let options_str = ''
            let i = 0
            for (let option of options) {
                options_str += VOTE_OPTIONS[i] + ' ' + option + '\n'
                i += 1
            }

            const embed = new RichEmbed()
                .setTitle(':bar_chart: ' + query)
                .setColor(LIGHT_BLUE)
                .setDescription(options_str)
            message.channel.send(embed).then(message => {
                const emojis = VOTE_EMOJIS.slice(0, options.length)
                for (let emoji of emojis) {
                    message.react(emoji)
                    sleep(500)
                }
            })
        }
    } else if (args[0].match(/^\/dice$/i) || args[0].match(/^\/roll$/i)) {
        if (args.length > 2 || (args.length === 2 && args[1].match(/^help$/i))) {
            help_dice(message.channel)
        } else {
            let dice = 1
            let d = false
            let faces = 6
            if (args.length === 2) {
                let matches = args[1].match(/^(?:([1-9]\d*)?(d))?([1-9]\d*)$/i)
                // could handle dice/face number overload in regex, but we want targeted error messages
                if (matches) {
                    matches = matches.slice(1)
                    if (matches[0]) {
                        dice = parseInt(matches[0])
                    }
                    if (matches[1]) {
                        d = true
                    }
                    faces = parseInt(matches[2])
                } else {
                    const embed = new RichEmbed()
                        .setTitle(':exclamation: Dice command error:')
                        .setColor(RED)
                        .setDescription('Please enter a valid number of faces and dice')
                    message.channel.send(embed)
                    return
                }

                if (dice > 100) {
                    const embed = new RichEmbed()
                        .setTitle(':exclamation: Dice command error:')
                        .setColor(RED)
                        .setDescription('Please use fewer than 100 dice')
                    message.channel.send(embed)
                    return
                }
                if (faces >= 1e18) {
                    const embed = new RichEmbed()
                        .setTitle(':exclamation: Dice command error:')
                        .setColor(RED)
                        .setDescription('Please use fewer than 1 quintillion faces')
                    message.channel.send(embed)
                    return
                }
            }
            let sum = 0
            let results = []
            for (let i = 0; i < dice; i += 1) {
                let result = Math.ceil(Math.random() * faces)
                sum += result
                if (d && (result == 1 || result == faces)) {
                    result = num_to_emoji(result)
                }
                results.push(result)
            }
            const embed = new RichEmbed()
                .setTitle(':game_die: Rolling '
                    + ((dice == 1) ? 'a' : dice) + ' '
                    + faces + '-sided dice:')
                .setColor(LIGHT_BLUE)
                .setDescription(results.join('+') + ((dice == 1) ? '' : (' = ' + sum)))
            message.channel.send(embed)
        }
    } else if (args[0].match(/^\/help$/i) || args[0].match(/^\/commands$/i)) {
        if (args.length === 2 && args[1].match(/^poll$/i)) {
            help_poll(message.channel)
        } else if (args.length === 2 && (args[1].match(/^dice$/i) || args[1].match(/^roll$/i))) {
            help_dice(message.channel)
        } else if (args.length === 2 && args[1].match(/^lab$/i)
                && is_facilitator(message.member)
                && is_management_channel(message.channel)) {
            help_lab_facilitator(message.channel)
        } else if (args.length === 2 && args[1].match(/^role$/i)) {
            help_role(message.channel)
        } else {
            const embed = new RichEmbed()
                .setTitle(':question: GDDBot Commands:')
                .setColor(LIGHT_BLUE)
                .setDescription('Roll a dice: `/roll`\n'
                    + 'Poll the channel: `/poll`\n'
                    + 'Lab Checkoffs (decal only): `/lab`\n'
                    + 'Add/Remove Role: `/role`\n')
                .setFooter('Made by Logikable#6019 for GDD :)')
            message.channel.send(embed)
        }
    } else if (args[0].match(/^\/checkoff$/i) || args[0].match(/^\/lab$/i)) {
        gapi_connect(rows => {
            if (is_facilitator(message.member) && is_management_channel(message.channel)) {
                if (args.length === 1 || (args.length === 2 && args[1].match(/^help$/i))) {
                    help_lab_facilitator(message.channel)
                    return
                }
                if (args[1].match(/^list$/i)) {
                    list_labs(message)
                    return
                }
                const headers = rows[0]
                if (args[1].match(/^missing$/i)) {  // check for missing at least one lab
                    let incomplete = []
                    for (let row of rows.slice(1)) {
                        for (let index = LAB_SKIP_HEADERS; index < headers.length; index += 1) {
                            if (!(index < row.length && row[index]) && row[1]) {
                                incomplete.push(row[1])
                                break
                            }
                        }
                    }
                    const embed = new RichEmbed()
                        .setTitle(':white_check_mark: Students missing at least one lab:')
                        .setColor(LIGHT_BLUE)
                        .setDescription((incomplete.length === 0) ?
                                '**None!** All students are done!' :
                                incomplete.join('\n'))
                    message.channel.send(embed)
                    return
                }
                const args_str = args.slice(1).join(' ')
                for (let index = LAB_SKIP_HEADERS; index < headers.length; index += 1) {
                    if (args_str.toLowerCase() === headers[index].toLowerCase()) {   // found header
                        let incomplete = []
                        for (let row of rows.slice(1)) {
                            if (!row[index] && row[1]) {
                                incomplete.push(row[1] +
                                    (row[0] ? ' [@' + row[0] + ']' : ''))
                            }
                        }
                        const embed = new RichEmbed()
                            .setTitle(':white_check_mark: Students missing ' + headers[index] + ':')
                            .setColor(LIGHT_BLUE)
                            .setDescription((incomplete.length === 0) ?
                                    '**None!** All students are done!' :
                                    incomplete.join('\n'))
                        message.channel.send(embed)
                        return
                    }
                }
                // if not the first two cases, then check for name
                for (let row of rows.slice(1)) {
                    if (row[1] && args_str.toLowerCase() === row[1].toLowerCase()) {
                        let incomplete = []
                        for (let index = LAB_SKIP_HEADERS; index < headers.length; index += 1) {
                            if (!(index < row.length && row[index])) {
                                incomplete.push(headers[index])
                            }
                        }
                        const embed = new RichEmbed()
                            .setTitle(':white_check_mark: ' + row[1] + ' is missing:')
                            .setColor(LIGHT_BLUE)
                            .setDescription((incomplete.length === 0) ? 
                                    'Nothing!' :
                                    incomplete.join('\n'))
                        message.channel.send(embed)
                        return
                    }
                }
                // if neither lab nor student was found
                const embed = new RichEmbed()
                    .setTitle(':exclamation: Lab command error:')
                    .setColor(RED)
                    .setDescription('Student or lab name was not found')
                message.channel.send(embed)
                return
            }
            // default functionality for students
            const headers = rows[0]
            const tag = message.author.tag

            for (let row of rows.slice(1)) {
                if (row[0] && tag.toLowerCase() === row[0].toLowerCase()) {   // found their username!
                    let incomplete = []
                    let complete = []
                    for (let index = LAB_SKIP_HEADERS; index < headers.length; index += 1) {
                        if (index < row.length && row[index]) {
                            complete.push(headers[index])
                        } else {
                            incomplete.push(headers[index])
                        }
                    }
                    const embed = new RichEmbed()
                        .setTitle(':white_check_mark: Lab checkoff list:')
                        .setColor(LIGHT_BLUE)
                        .setDescription(
                            'Progress: ' + complete.length + '/' + (headers.length - LAB_SKIP_HEADERS)
                            + '\n\n'
                            + ((incomplete.length === 0) ?
                                '**Congrats! You\'re all caught up.**' :
                                '**Incomplete labs:**\n' + incomplete.join('\n'))
                            + '\n\n'
                            + '**Completed labs:** ' + complete.join(', '))
                        .setFooter('Please notify a facilitator if something is wrong!')
                    message.author.send(embed)
                    return
                }
            }
            // never found their username
            student_not_found(message.author)
        }, LAB_ID)
    } else if (args[0].match(/^\/intro$/i)) {
        introduce_server(message.author)
    // } else if (message.content.match(/^(?:\S+\s+)*(wes|wesley)[,.]?(?:\s+(?:\S+\s+)*)?$/i)
    //         && is_management_channel(message.channel)) {
    //     const wes_list = ['welsey', 'weesley', 'weasley', 'weaslely', 'weasel-y', 'weselely']
    //     const random_wes = wes_list[Math.floor(Math.random() * wes_list.length)]
    //     message.channel.send(':bear: Did you mean: *' + random_wes + '*? :bear:')
    } else if (args[0].match(/^\/addrole$/i)) {
        if (args.length === 1 || (args.length === 2 && args[1].match(/^help$/i))) {
            help_role(message.channel)
        } else {
            add_role(message, args.slice(1))
        }
    } else if (args[0].match(/^\/removerole$/i) || args[0].match(/^\/deleterole$/i)) {
        if (args.length === 1 || (args.length === 2 && args[1].match(/^help$/i))) {
            help_role(message.channel)
        } else {
            remove_role(message, args.slice(1))
        }
    } else if (args[0].match(/^\/role$/i)) {
        if (args.length >= 3 && args[1].match(/^add$/i)) {
            add_role(message, args.slice(2))
        } else if (args.length >= 3 && (args[1].match(/^remove$/i) || args[1].match(/^delete$/i))) {
            remove_role(message, args.slice(2))
        } else {
            help_role(message.channel)
        }
    } else if (args[0].match(/^\/labs$/i) && is_management_channel(message.channel)) {
        list_labs(message)
    } else if (args[0].match(/^\/project$/i)) {
        gapi_connect(rows => {
            const headers = rows[0]
            const tag = message.author.tag

            for (let row of rows.slice(1)) {
                if (row[0] && tag.toLowerCase() === row[0].toLowerCase()) {   // found their username!
                    let grades = []
                    for (let index = PROJECT_SKIP_HEADERS; index < headers.length; index += 1) {
                        if (index < row.length) {
                            grades.push('**' + headers[index] + '**: ' + row[index])
                        } else {
                            grades.push('**' + headers[index] + '**:')
                        }
                    }
                    const embed = new RichEmbed()
                        .setTitle(':white_check_mark: Project checkoff list:')
                        .setColor(LIGHT_BLUE)
                        .setDescription(grades.join('\n'))
                        .setFooter('Please notify a facilitator if something is wrong!')
                    message.author.send(embed)
                    return
                }
            }
            // never found their username
            student_not_found(message.author)
        }, PROJECT_ID)
    } else if (args[0].match(/^\/attendance$/i)) {
        gapi_connect(rows => {
            const headers = rows[4]
            const tag = message.author.tag

            for (let row of rows.slice(5)) {
                if (row[2] && tag.toLowerCase() === row[2].toLowerCase()) {    // found their username!
                    let present = 0
                    let unexcused = 0
                    let excused = 0
                    for (let index = ATTENDANCE_SKIP_HEADERS;
                            index < ATTENDANCE_SKIP_HEADERS + DECAL_MEETINGS;
                            index += 1) {
                        if (index < row.length) {
                            if (row[index].match(/^X$/i)) {
                                present += 1
                            } else if (row[index].match(/^U$/i)) {
                                unexcused += 1
                            } else if (row[index].match(/^E$/i)) {
                                excused += 1
                            }
                        }
                    }
                    const embed = new RichEmbed()
                        .setTitle(':white_check_mark: Decal attendance:')
                        .setColor(LIGHT_BLUE)
                        .setDescription('Present: ' + present + '\n'
                            + 'Excused: ' + excused + '\n'
                            + 'Unexcused: ' + unexcused
                            + ((unexcused >= 2) ?
                                '\n\n**Warning:** You have already used both of your unexcused absences! '
                                    + 'Missing future classes may affect your grade.'
                                : ''))
                    message.author.send(embed)
                    return
                }
            }
            // never found their username
            student_not_found(message.author)
        }, ATTENDANCE_ID)
    }
})

client.on('ready', () => {
    client.user.setPresence({ game: { name: '/help to get started!'}})
    console.log('Ready.')
})

client.on('error', e => console.error(e))
client.on('warn', e => console.warn(e))
// client.on('debug', e => console.info(e))

client.login(token)
