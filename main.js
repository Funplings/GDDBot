/*
Ideas:
Minor topic: club stuff?
 - role submission
   - check if a new submission exists, ping #development
   - staff can add artist/programmer/music/design

team making command
Retention statistics

TODO:
Documentation README
*/

// testing
console.log("Running main.js")

/*** Global Variables ***/

// reqs
const fs = require('fs')
const sleep = require('system-sleep')
const { Client, DMChannel, MessageEmbed, MessageMentions } = require('discord.js')
const { google } = require('googleapis')
const schedule = require('node-schedule')

// // google api
// const TOKEN_PATH = 'gapi_token.json'
// // discord
// const token = fs.readFileSync('token').toString().replace(/(\r\n|\n|\r)/gm, "");

// Initialize Discord client
const client = new Client()

// // discord token
// const token = process.env.DJS_TOKEN

// google

// constants
const NUM_EMOJIS = [':zero:', ':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:']
const VOTE_OPTIONS = [':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:', ':zero:']
const VOTE_EMOJIS = ['\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3', '\u0034\u20E3', '\u0035\u20E3',  '\u0036\u20E3', '\u0037\u20E3', '\u0038\u20E3', '\u0039\u20E3', '\u0030\u20E3']
const LIGHT_BLUE = 0xADD8E6
const RED = 0xFF0000

const GUILD_IDS = ['433080296057864192',    // official GDD server
    '317420684689276928',   // testing server
]
const ADMIN_IDS = ['249014951295975429',   // matthew
]
const SUGG_RECIP_USER_IDS = ['234520560355246080',  // imon
    '249014951295975429',   // matthew
]
const MANAGEMENT_CATEGORY_IDS = ['433105370962198530',  // official GDD management channel category
    '494362107417198592',   // testing server channel category
]

// Decal grading spreadsheet
const GRADING_SHEET_ID = '1_IsFEBELB-I2-VHFhNxi902_0ps_Uj6Fsf4DlM4aAgw'

// All row/column numbers are 0 indexed.
const NUM_HEADERS = 4
const DISCORD_ID_COLUMN = 0
const STUDENT_NAME_COLUMN = 2
const NAME_ROW = 2
const DUE_DATE_ROW = 3
// Labs
const LAB_START_COLUMN = 3
const NUM_LABS = 7
const NUM_LAB_COLUMNS = 8
const LABS_TOTAL_WEIGHT = 0.1
// Written Responses
const WRITINGS_START_COLUMN = 22
const NUM_WRITINGS = 8
const WRITINGS_TOTAL_WEIGHT = 0.1
// Projects
const PROJECT_ONE_PART1_COLUMN = 11
const PROJECT_ONE_PART1_WEIGHT = 0.05
const PROJECT_ONE_PART2_COLUMN = 12
const PROJECT_ONE_PART2_WEIGHT = 0.05
const PROJECT_TWO_COLUMN = 13
const PROJECT_TWO_WEIGHT = 0.1
const PROJECT_THREE_MENTOR_EVAL_COLUMN = 14
const PROJECT_THREE_MENTOR_EVAL_WEIGHT = 0.6 * 0.4
const PROJECT_THREE_MENTOR_EVAL_MAX = 4
const PROJECT_THREE_TEAM_EVAL_START_COLUMN = 16
const PROJECT_THREE_NUM_TEAM_EVALS = 3
const PROJECT_THREE_FINAL_SCORE_COLUMN = 18
const PROJECT_THREE_FINAL_SCORE_WEIGHT = 0.6 * 0.2
const PROJECTS_TOTAL_WEIGHT = 0.8
// Attendance
const ABSENCES_COLUMN = 32
const PERMITTED_UNEXCUSED_ABSENCES = 2
const UNEXCUSED_ABSENCES_DEDUCT = 0.1

let queue = []

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

function is_admin(user) {
    return ADMIN_IDS.includes(user.id)
}

function is_facilitator(member) {
    return member && member.roles && (member.roles.find("name", "Facilitator") || member.roles.find("name", "Moderator"))
}

function is_management_channel(channel) {
    return MANAGEMENT_CATEGORY_IDS.includes(channel.parentID)
}

function gapi_connect(callback, spreadsheet_id) {
    // initialize google api oAuth2 client
    // fs.readFile('gapi_credentials.json', (err, content) => {
    //     const { client_secret, client_id, redirect_uris } = JSON.parse(content).installed
    //     const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    //     fs.readFile(TOKEN_PATH, (err, token) => {
    //         oAuth2Client.setCredentials(JSON.parse(token))
    //         const sheets = google.sheets({ version: 'v4', auth: oAuth2Client })
    //         sheets.spreadsheets.values.get({
    //             spreadsheetId: spreadsheet_id,
    //             range: 'Sheet1!A:ZZ',
    //         }, (err, res) => {
    //             if (err) return console.log('API Error: ' + err)
    //             const rows = res.data.values
    //             callback(rows)
    //         })
    //     })
    // })
    console.log("gapi_connect starting")
    console.log(process.env.GAPI_CREDENTIALS)
    console.log(process.env.GAPI_TOKEN)
    const { client_secret, client_id, redirect_uris } = JSON.parse(process.env.GAPI_CREDENTIALS).installed
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    oAuth2Client.setCredentials(JSON.parse(process.env.GAPI_TOKEN))
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client })
            sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheet_id,
                range: 'Sheet1!A:ZZ',
            }, (err, res) => {
                if (err) return console.log('API Error: ' + err)
                const rows = res.data.values
                callback(rows)
            })
}

// returns a role, returning null if not found
function parse_role(message, args) {
    const args_str = args.join(' ')
    if (args_str.match(/^league(?:\s*of\s*legends?)?|lol$/i)) {
        return message.guild.roles.cache.find(r => r.name === 'League of Legends')
    } else if (args_str.match(/^overwatch|ow$/i)) {
        return message.guild.roles.cache.find(r => r.name === 'Overwatch')
    } else if (args_str.match(/^climb(?:ing)?$/i)) {
        return message.guild.roles.cache.find(r => r.name === 'Climbing')
    } else if (args_str.match(/^m(?:ine)?c(?:raft)?$/i)) {
        return message.guild.roles.cache.find(r => r.name === 'Minecraft')
    } else if (args_str.match(/artist/i)) {
        return message.guild.roles.cache.find(r => r.name === 'Artist')
    } else if (args_str.match(/musician/i)) {
        return message.guild.roles.cache.find(r => r.name === 'Musician')
    } else if (args_str.match(/programmer/i)) {
        return message.guild.roles.cache.find(r => r.name === 'Programmer')
    } else if (args_str.match(/design/i)) {
        return message.guild.roles.cache.find(r => r.name === 'Design')
    }
    return null
}

function pad(str, n) {
    if (str.length > n) {
        return str
    }
    return str + Array((n - str.length) + 1).join(".")
}

/*** Help Functions ***/

function help_poll(channel) {
    const embed = new MessageEmbed()
        .setTitle(':bar_chart: /poll usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('Yes / No: `/poll "Boba?"`\n'
            + 'Multi answer (up to 10): `/poll "Where?" "UCha" "Asha"`')
    channel.send(embed)
}

function help_dice(channel) {
    const embed = new MessageEmbed()
        .setTitle(':game_die: /dice usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('Roll a 6 sided dice: `/dice`\n'
            + 'Roll a dice with any number of faces: `/dice d20`\n'
            + 'Roll a number of dice: `/dice 4d6`')
    channel.send(embed)
}

// function help_role(channel) {
//     const embed = new MessageEmbed()
//         .setTitle(':question: /role usage:')
//         .setColor(LIGHT_BLUE)
//         .setDescription('Adding a role: `/role add <game>` `/addrole <name>`\n'
//             + 'Removing a role: `/role remove <name>` `/removerole <name>`')
//     channel.send(embed)
// }

function help_addrole(channel) {
    const embed = new MessageEmbed()
        .setTitle(':question: /addrole usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('Adding a role: `/role add <rolename>`')
    channel.send(embed)
}

function help_removerole(channel) {
    const embed = new MessageEmbed()
        .setTitle(':question: /removerole usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('Removing a role: `/role remove <rolename>`')
    channel.send(embed)
}

function help_queue(channel) {
    const embed = new MessageEmbed()
        .setTitle(':busts_in_silhouette: /q usage:')
        .setColor(LIGHT_BLUE)
        .setDescription('Join the queue: `/q join`\n'
            + 'Next speaker: `/q next`\n'
            + 'List speakers: `/q list`\n'
            + 'Clear queue: `/q clear`\n'
            + 'Skip speaker: `/q skip <n>`')
    channel.send(embed)
}

/*** Command (Helper) Functions ***/

function introduce_server(user) {
    const msg = 'This is the Discord server for the Game Design and Development club at Berkeley. '
        + 'If you\'re interested in making games, this is the place for you. We look forward to working with you :smile:\n\n'
        + 'Please read #welcome-and-rules and #apply-for-role.'

    const embed = new MessageEmbed()
        .setTitle(':game_die: Welcome to GDD! :bear:')
        .setColor(LIGHT_BLUE)
        .setDescription(msg)
    user.send(embed)
}

function can_only_be_used_in_guild(channel) {
    const embed = new MessageEmbed()
        .setTitle(':exclamation: Command error:')
        .setColor(RED)
        .setDescription('Sorry, that command can only be used in the GDD server')
    channel.send(embed)
}

// notifies the channel
function role_not_found(channel) {
    const embed = new MessageEmbed()
        .setTitle(':exclamation: That role couldn\'t be found')
        .setColor(RED)
    channel.send(embed)
}

function turn_off_invisible(channel) {
    const embed = new MessageEmbed()
        .setTitle(':exclamation: Set your status away from `invisible` to use this command')
        .setColor(RED)
    channel.send(embed)
}

function student_not_found(author) {
    const embed = new MessageEmbed()
        .setTitle(':exclamation: Command error:')
        .setColor(RED)
        .setDescription('This command is for people currently in the decal. '
            + 'If you\'re in the decal but this message is showing, let a facilitator know.')
    author.send(embed)
}

async function add_role(message, args) {
    if (!message.guild || !GUILD_IDS.includes(message.guild.id)) {
        can_only_be_used_in_guild(message.channel)
        return
    }
    const role = parse_role(message, args)
    if (!role) {
        role_not_found(message.channel)
        return
    }
    if (!message.member) {
        turn_off_invisible(message.channel)
        return
    }
    if (message.member.roles.cache.has(role.id)) {
        const embed = new MessageEmbed()
            .setTitle(':exclamation: You already have that role')
            .setColor(RED)
        message.channel.send(embed)
        return
    }
    await message.member.roles.add([role])
        .then(console.log)
        .catch(console.error)
    const embed = new MessageEmbed()
        .setTitle(':white_check_mark: Role added')
        .setColor(LIGHT_BLUE)
    message.channel.send(embed)
}

async function remove_role(message, args) {
    if (!message.guild || !GUILD_IDS.includes(message.guild.id)) {
        can_only_be_used_in_guild(message.channel)
        return
    }
    const role = parse_role(message, args)
    if (!role) {
        role_not_found(message.channel)
        return
    }
    if (!message.member) {
        turn_off_invisible(message.channel)
        return
    }
    if (!message.member.roles.cache.has(role.id)) {
        const embed = new MessageEmbed()
            .setTitle(':exclamation: You don\'t have that role')
            .setColor(RED)
        message.channel.send(embed)
        return
    }
    await message.member.roles.remove([role])
        .then(console.log)
        .catch(console.error)
    const embed = new MessageEmbed()
        .setTitle(':white_check_mark: Role removed')
        .setColor(LIGHT_BLUE)
    message.channel.send(embed)
}

/*** Cron Jobs ***/

// lab reminders
const lab_reminder_cron = schedule.scheduleJob('0 12 * * 6', () => {
    return // turned off

    gapi_connect(rows => {
        const today = new Date()

        const raw_dates = rows[DUE_DATE_ROW]
        let dates = []
        for (let index = LAB_START_COLUMN; index < LAB_START_COLUMN + NUM_LABS; index++) {
            dates.push(new Date(raw_dates[index]))
        }

        for (let row of rows.slice(NUM_HEADERS)) {
            if (row[DISCORD_ID_COLUMN]) {   // only ping people who have discord
                let overdue = []
                let due_soon = []
                for (let index = 0; index < NUM_LABS; index++) {
                    if (!row[index + LAB_START_COLUMN]) {
                        if (today - dates[index] > 0) {
                            overdue.push(rows[NAME_ROW] + ', due on ' + raw_dates[index])
                        } else if (dates[index] - today <= 86400 * 1000 * 7) {  // due within a week
                            due_soon.push(rows[NAME_ROW] + ', due on ' + raw_dates[index])
                        }
                    }
                }
                const embed = new MessageEmbed()
                    .setTitle(':white_check_mark: Lab checkoff reminders!')
                    .setColor(LIGHT_BLUE)
                    .setDescription('**Overdue labs:**\n'
                        + ((overdue.length === 0) ? 'None!' : overdue.join('\n'))
                        + '\n\n'
                        + '**Labs due next week:**\n'
                        + ((due_soon.length === 0) ? 'None!' : due_soon.join('\n')))
                const user = client.users.find(user => user.tag.toLowerCase() === row[0].toLowerCase())
                if (user) {
                    user.send(embed)
                } else {
                    console.log('Failed to send reminder to ' + row[0] + '.')
                }
            }
        }
    }, GRADING_SHEET_ID)
})

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
            client.users.fetch(admin_id).then(user => {
                user.send(content)
            }).catch(e => console.log(e))
        }
    }
    if (args[0].match(/^\/poll$/i)) {
        if (args.length === 1 || (args.length === 2 && args[1].match(/^help$/i))) {
            help_poll(message.channel)
        } else if (args.length > 12) {
            const embed = new MessageEmbed()
                .setTitle(':exclamation: Too many answers - max 10')
                .setColor(RED)
            message.channel.send(embed)
        } else if (args[1].length > 200) {
            const embed = new MessageEmbed()
                .setTitle(':exclamation: Question too long, 200 characters maximum')
                .setColor(RED)
            message.channel.send(embed)
        } else if (args.length === 2) {
            const query = args[1]
            const embed = new MessageEmbed()
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

            const embed = new MessageEmbed()
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
    } else if (args[0].match(/^\/(?:dice|roll)$/i)) {
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
                    const embed = new MessageEmbed()
                        .setTitle(':exclamation: Please enter a valid number of faces and dice')
                        .setColor(RED)
                    message.channel.send(embed)
                    return
                }

                if (dice > 100) {
                    const embed = new MessageEmbed()
                        .setTitle(':exclamation: Please use fewer than 100 dice')
                        .setColor(RED)
                    message.channel.send(embed)
                    return
                }
                if (faces >= 1e18) {
                    const embed = new MessageEmbed()
                        .setTitle(':exclamation: Please use fewer than 1 quintillion faces')
                        .setColor(RED)
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
            const embed = new MessageEmbed()
                .setTitle(':game_die: Rolling '
                    + ((dice == 1) ? 'a' : dice) + ' '
                    + faces + '-sided dice:')
                .setColor(LIGHT_BLUE)
                .setDescription(results.join('+') + ((dice == 1) ? '' : (' = ' + sum)))
            message.channel.send(embed)
        }
    } else if (args[0].match(/^\/help$/i) || args[0].match(/^\/command(?:s)?$/i)) {
        if (args.length === 2 && args[1].match(/^poll$/i)) {
            help_poll(message.channel)
        } else if (args.length === 2 && (args[1].match(/^dice|roll$/i))) {
            help_dice(message.channel)
        } else if (args.length === 2 && args[1].match(/^addrole$/i)) {
                help_addrole(message.channel)
        } else if (args.length === 2 && args[1].match(/^removerole$/i)) {
                    help_removerole(message.channel)
        } else if (args.length === 2 && args[1].match(/^q(?:ueue)?$/i)
                && is_management_channel(message.channel)) {
            help_queue(message.channel)
        } else {
            const embed = new MessageEmbed()
                .setTitle(':question: GDDBot Commands:')
                .setColor(LIGHT_BLUE)
                .setDescription('Roll a dice: `/roll`\n'
                    + 'Poll the channel: `/poll`\n'
                    + 'Add Role: `/addrole`\n'
                    + 'Remove Role: `/removerole`\n'
                    + 'Suggest a Resource: `/suggest <suggestion>`\n'
                    + 'Website: `/website`\n'
                    + (is_management_channel(message.channel) ? 'Meeting Queue: `/q`\n' : '')
                    + '\n**Decal Only:**\n'
                    + 'Grading: `/grade`\n')
                .setFooter('Made by Logikable#6019 for GDD :)')
            message.channel.send(embed)
        }
    } else if (args[0].match(/^\/grade$/i)) {
        gapi_connect(rows => {
            const tag = message.author.tag

            // Search through rows of the spreadhseet
            for (let row of rows.slice(NUM_HEADERS)) {

                // If this row belongs to the author of the message:
                if (row[DISCORD_ID_COLUMN] && row[DISCORD_ID_COLUMN].toLowerCase() === tag.toLowerCase()) {
                    // Counting how many points the student has. 70 is required to pass.
                    let points = 0
                    let description = ""

                    // Labs
                    // Labs heading
                    description += "**Labs:** [10%]\n"
                    description += "```"
                    let labs_completed = 0

                    // Iterate through labs
                    for (let index = LAB_START_COLUMN; index < LAB_START_COLUMN + NUM_LAB_COLUMNS; index++) {
                        description += pad(rows[NAME_ROW][index] + ":", 40)
                        if (row[index] === '') {
                            description += "due "
                        } else if (row[index].toLowerCase() === 'x') {
                            labs_completed += 1;
                            description += "P   "
                        } else if (row[index].toLowerCase() === 'f') {
                            description += "NP  "
                        }
                        description += '[' + rows[DUE_DATE_ROW][index] + ']\n'
                    }
                    description += "```"
                    points += 100.0 * LABS_TOTAL_WEIGHT * labs_completed / NUM_LABS
                    description += 'Labs Completed: ' + labs_completed + '/' + NUM_LABS + '\n';
                    description += '**Lab Grade: ' + (100.0 * labs_completed / NUM_LABS).toFixed() + '%**\n\n'

                    // Written Responses
                    description += '**Written Responses:** [10%]\n'
                    description += '```'
                    let writings_completed = 0
                    for (let index = WRITINGS_START_COLUMN; index < WRITINGS_START_COLUMN + NUM_WRITINGS; index++) {
                        description += pad(rows[NAME_ROW][index] + ":", 40)
                        if (row[index] === '') {
                            description += "due "
                        } else if (row[index].toLowerCase() === 'x') {
                            writings_completed += 1;
                            description += "P   "
                        } else if (row[index].toLowerCase() === 'f') {
                            description += "NP  "
                        }
                        description += '[' + rows[DUE_DATE_ROW][index] + ']\n'
                    }
                    description += '```'
                    points += 100.0 * WRITINGS_TOTAL_WEIGHT * writings_completed / NUM_WRITINGS
                    description += 'Written Responses Completed: ' + writings_completed + '/' + NUM_WRITINGS + '\n';
                    description += '**Written Responses Grade: ' + (100.0 * writings_completed / NUM_WRITINGS).toFixed() + '%**\n\n'

                    // Projects
                    description += '**Projects:** [80%]\n'
                    project_points = 0
                    // Project 1-1
                    description += '```'
                    description += pad('Project 1-1 [5%]:', 30)
                    if (row[PROJECT_ONE_PART1_COLUMN] === '') {
                        description += "due "
                    } else if (row[PROJECT_ONE_PART1_COLUMN].toLowerCase() === 'x') {
                        project_points += PROJECT_ONE_PART1_WEIGHT
                        description += "P   "
                    } else if (row[PROJECT_ONE_PART1_COLUMN].toLowerCase() === 'f') {
                        description += "NP  "
                    }
                    description += '[' + rows[DUE_DATE_ROW][PROJECT_ONE_PART1_COLUMN] + ']\n'
                    // Project 1-2
                    description += pad('Project 1-2 [5%]:', 30)
                    if (row[PROJECT_ONE_PART2_COLUMN] === '') {
                        description += "due "
                    } else if (row[PROJECT_ONE_PART2_COLUMN].toLowerCase() === 'x') {
                        project_points += PROJECT_ONE_PART2_WEIGHT
                        description += "P   "
                    } else if (row[PROJECT_ONE_PART2_COLUMN].toLowerCase() === 'f') {
                        description += "NP  "
                    }
                    description += '[' + rows[DUE_DATE_ROW][PROJECT_ONE_PART2_COLUMN] + ']\n'
                    // Project 2
                    description += pad('Project 2 [10%]:', 30)
                    if (row[PROJECT_TWO_COLUMN] === '') {
                        description += "due "
                    } else if (row[PROJECT_TWO_COLUMN].toLowerCase() === 'x') {
                        project_points += PROJECT_TWO_WEIGHT
                        description += "P   "
                    } else if (row[PROJECT_TWO_COLUMN].toLowerCase() === 'f') {
                        description += "NP  "
                    }
                    description += '[' + rows[DUE_DATE_ROW][PROJECT_TWO_COLUMN] + ']\n'
                    // Project 3
                    description += 'Project 3 [60%]:\n'
                    description += pad('  Mentor Evaluation [24%]:', 30)
                    if (row[PROJECT_THREE_MENTOR_EVAL_COLUMN] === '') {
                        description += "ungraded"
                    } else {
                        description += row[PROJECT_THREE_MENTOR_EVAL_COLUMN] + '/' + PROJECT_THREE_MENTOR_EVAL_MAX
                        project_points += PROJECT_THREE_MENTOR_EVAL_WEIGHT * parseInt(row[PROJECT_THREE_MENTOR_EVAL_COLUMN]) / PROJECT_THREE_MENTOR_EVAL_MAX
                    }
                    description += "\n"
                    description += '  Team Evaluation [24%]: \n'
                    description += '    Evaluation 1: hidden\n'
                    description += '    Evaluation 2: hidden\n'
                    description += '    Evaluation 3: hidden\n'
                    description += pad('  Final Score [12%]:', 30)
                    if (row[PROJECT_THREE_FINAL_SCORE_COLUMN] === '') {
                        description += "ungraded"
                    } else if (row[PROJECT_THREE_FINAL_SCORE_COLUMN].toLowerCase() === 'x') {
                        project_points += PROJECT_THREE_FINAL_SCORE_WEIGHT
                        description += "P   "
                    } else if (row[PROJECT_THREE_FINAL_SCORE_COLUMN].toLowerCase() === 'f') {
                        description += "NP  "
                    }
                    description += '```'
                    points += 100.0 * project_points
                    description += "**Projects Grade: " + (100.0 * project_points / PROJECTS_TOTAL_WEIGHT).toFixed() + "%**\n\n"

                    // Absences
                    const absences = row[ABSENCES_COLUMN] ? parseInt(row[ABSENCES_COLUMN]) : 0
                    description += "Unexcused Absences: " + absences + '\n'
                    deduction = Math.max(0, ((absences - PERMITTED_UNEXCUSED_ABSENCES) * 100.0 * UNEXCUSED_ABSENCES_DEDUCT))
                    points -= deduction
                    description += "Grade Deduction: " + deduction.toFixed() + "%\n"

                    // Total
                    description += "**Total Score: " + points.toFixed() + "%**\n"
                    description += "Final Grade: " + (points >= 70 ? "P" : "NP")

                    const embed = new MessageEmbed()
                        .setTitle(':bear: GDD Decal Grading Sheet for ' + row[STUDENT_NAME_COLUMN] + ':')
                        .setColor(LIGHT_BLUE)
                        .setDescription(description)
                        .setFooter('Please notify a facilitator if something is wrong! Note that your final grade may not be accurate until the last day.')
                    message.author.send(embed)
                    return
                }
            }
            student_not_found(message.author)
        }, GRADING_SHEET_ID)
    } else if (args[0].match(/^\/intro$/i)) {
        introduce_server(message.author)
    } else if (args[0].match(/^\/addrole$/i)) {
        if (args.length === 1 || (args.length === 2 && args[1].match(/^help$/i))) {
            help_addrole(message.channel)
        } else {
            add_role(message, args.slice(1))
        }
    } else if (args[0].match(/^\/(?:remove|delete)role$/i)) {
        if (args.length === 1 || (args.length === 2 && args[1].match(/^help$/i))) {
            help_removerole(message.channel)
        } else {
            remove_role(message, args.slice(1))
        }
    // } else if (args[0].match(/^\/role$/i)) {
    //     if (args.length >= 3 && args[1].match(/^add$/i)) {
    //         add_role(message, args.slice(2))
    //     } else if (args.length >= 3 && (args[1].match(/^remove|delete$/i))) {
    //         remove_role(message, args.slice(2))
    //     } else {
    //         help_role(message.channel)
    //     }
    } else if (args[0].match(/^\/suggest(?:ion)?$/i) && args.length > 1) {
        const args_str = message.content.substring(args[0].length + 1)
        const suggestion = new MessageEmbed()
            .setTitle(':bear: This just in!')
            .setColor(LIGHT_BLUE)
            .setDescription('From '
                + (message.member ? message.member.displayName : message.author.tag) + ': '
                + args_str)
        for (let user_id of SUGG_RECIP_USER_IDS) {  // forward to admins
            client.users.find('id', user_id).send(suggestion)
        }

        // give the user a response
        const embed = new MessageEmbed()
            .setTitle(':bear: Thanks for the suggestion!')
            .setColor(LIGHT_BLUE)
            .setDescription('Your suggestion has been forwarded.')
        message.channel.send(embed)
    } else if (args[0].match(/^\/pm$/i) && is_admin(message.author) && args.length > 2) {
        const args_str = args.slice(2).join(' ')
        const id = args[1]
        client.users.find('id', id).send(args_str)
    } else if (args[0].match(/^\/git(?:hub)?$/i)) {
        const embed = new MessageEmbed()
            .setTitle(':bear: GDDBot Github link:')
            .setColor(LIGHT_BLUE)
            .setDescription('https://github.com/logikable/GDDBot')
        message.channel.send(embed)
    } else if (args[0].match(/^\/web(?:site)?$/i)) {
        const embed = new MessageEmbed()
            .setTitle(':bear: GDD website link:')
            .setColor(LIGHT_BLUE)
            .setDescription('https://gamedesign.berkeley.edu/')
        message.channel.send(embed)
    } else if (args[0].match(/^\/q(?:ueue)?$/i)
            && is_management_channel(message.channel)) {
        if (args.length == 1 || args[1].match(/^h(?:elp)?$/i)) {
            help_queue(message.channel)
            return
        }
        if (args[1].match(/^j(?:oin)?$/i)) {
            queue.push(message.member.displayName)
            const embed = new MessageEmbed()
                .setTitle(':busts_in_silhouette: Queue joined')
                .setColor(LIGHT_BLUE)
            message.channel.send(embed)
        } else if (args[1].match(/^n(?:ext)?$/i)) {
            if (queue.length === 0) {
                const embed = new MessageEmbed()
                    .setTitle(':exclamation: Queue empty')
                    .setColor(RED)
                message.channel.send(embed)
            } else {
                const next = queue.shift()
                const embed = new MessageEmbed()
                    .setTitle(':busts_in_silhouette: Now speaking:')
                    .setColor(LIGHT_BLUE)
                    .setDescription(next)
                message.channel.send(embed)
            }
        } else if (args[1].match(/^l(?:ist)?$/i)) {
            list = []
            for (let i = 0; i < queue.length; i += 1) {
                list.push((i + 1) + '. ' + queue[i])
            }
            const embed = new MessageEmbed()
                .setTitle(':busts_in_silhouette: Speaker order:')
                .setColor(LIGHT_BLUE)
                .setDescription((list.length === 0) ? 'Queue is empty!'
                    : list.join('\n'))
            message.channel.send(embed)
        } else if (args[1].match(/^c(?:lear)?$/i)) {
            queue = []
            const embed = new MessageEmbed()
                .setTitle(':busts_in_silhouette: Queue cleared')
                .setColor(LIGHT_BLUE)
            message.channel.send(embed)
        } else if (args[1].match(/^s(?:kip)?$/i)) { // there is a number after
            let remove_index
            if (args.length === 2) {
                remove_index = 0
            } else {
                let matches = args[2].match(/^([1-9][0-9]*)$/i)
                if (!matches) {
                    const embed = new MessageEmbed()
                        .setTitle(':exclamation: Invalid position in queue.')
                        .setColor(RED)
                    message.channel.send(embed)
                    return
                }
                matches = matches.slice(1)  // ignore first match; matches entire string
                remove_index = parseInt(matches[0]) - 1
            }
            if (remove_index >= queue.length) {
                const embed = new MessageEmbed()
                    .setTitle(':exclamation: There are '
                        + (queue.length === 0 ? 'no speakers' : 'only ' + queue.length + ' speaker(s)')
                        + ' in queue')
                    .setColor(RED)
                message.channel.send(embed)
                return
            }
            queue.splice(remove_index, 1)
            const embed = new MessageEmbed()
                .setTitle(':busts_in_silhouette: Speaker removed')
                .setColor(LIGHT_BLUE)
            message.channel.send(embed)
            return
        }
    } else if (args[0].match(/^\/kill$/i)
            && is_admin(message.author)) {
        if (args.length === 1) {
            return
        }
        if (args[1].match(/^lab_reminders$/i)) {
            lab_reminder_cron.cancel()
            const embed = new MessageEmbed()
                .setTitle(':skull_crossbones: Cron killed')
                .setColor(RED)
            message.channel.send(embed)
        }
    }
})

client.on('ready', () => {
    client.user.setPresence({ game: { name: '/help to get started!'}})
    console.log('Ready.')
})

client.on('error', e => console.error(e))
client.on('warn', e => console.warn(e))
// client.on('debug', e => console.info(e))

client.login(process.env.DJS_TOKEN)
