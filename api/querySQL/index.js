const {
    loadConfiguration,
    OnBehalfOfUserCredential,
    ResourceType,
    DefaultTediousConnectionConfiguration,
    UserInfo,
} = require("teamsdev-client");
const { Connection, Request } = require('tedious');
const axios = require('axios');

/**
 * This function handles requests sent from teamsfx client SDK.
 * The HTTP request should contain an SSO token in the header and any content in the body.
 * The SSO token should be queried from Teams client by teamsfx client SDK.
 * Before trigger this function, teamsfx binding would process the SSO token and generate teamsfx configuration.
 *
 * This function initializes the teamsfx Server SDK with the configuration and calls these APIs:
 * - getUserInfo() - Get the user's information from the received SSO token.
 * - getMicrosoftGraphClientWithUserIdentity() - Get a graph client to access user's Microsoft 365 data.
 *
 * The response contains multiple message blocks constructed into a JSON object, including:
 * - An echo of the request body.
 * - The display name encoded in the SSO token.
 * - Current user's Microsoft 365 profile if the user has consented.
 *
 * @param {Context} context - The Azure Functions context object.
 * @param {HttpRequest} req - The HTTP request.
 * @param {teamsfxConfig} config - The teamsfx configuration generated by teamsfx binding.
 */
module.exports = async function (context, req, config) {
    let connection;
    loadConfiguration();

    try {
        connection = await getSQLConnection();
        const method = req.method.toLowerCase();

        // Use TeamsFx server SDK to get user object id from user SSO token
        const accessToken = config.AccessToken;

        const credential = new OnBehalfOfUserCredential(accessToken);
        const currentUser = await credential.getUserInfo();
        const objectId = currentUser.objectId;
        var query;

        switch (method) {
            case "get":
                query = "select Id as id, Content as description, Status as isCompleted from dbo.Demo where " + (req.body ? `Id = ${req.body.id}` : `ObjectId = '${objectId}'`);
                break;
            case "put":
                if (req.body.description) {
                    query = `update dbo.Demo set Content = N'${req.body.description}' where Id = ${req.body.id}`;
                } else {
                    query = `update dbo.Demo set Status = ${req.body.isCompleted ? 1 : 0} where Id = ${req.body.id}`;
                }
                break;
            case "post":
                try {
                    axios.default.post("https://microsoft.webhook.office.com/webhookb2/ac20fe39-265f-4c00-b45e-44a8ca5f8c62@72f988bf-86f1-41af-91ab-2d7cd011db47/IncomingWebhook/20590c6aa53446f6b07751e6ebedf076/46c1e2e4-472f-4132-bbd1-47556e0da3eb", {
                        text: "New To-Do item is created: " + req.body.description
                    });
                } catch (error) { }
                query = `insert into dbo.Demo (Content, ObjectId, Status) values (N'${req.body.description}','${objectId}',${req.body.isCompleted ? 1 : 0})`;
                break;
            case "delete":
                query = "delete from dbo.Demo where " + (req.body ? `Id = ${req.body.id}` : `ObjectId = '${objectId}'`);
                break;
        }
        // Execute SQL through TeamsFx server SDK generated connection and return result
        const result = await execQuery(query, connection);
        return {
            status: 200,
            body: result
        }
    }
    catch (err) {
        return {
            status: 500,
            body: err.message
        }
    }
    finally {
        if (connection) {
            connection.close();
        }
    }
}

async function getSQLConnection() {
    const sqlConnectConfig = new DefaultTediousConnectionConfiguration();
    const config = await sqlConnectConfig.getConfig();
    const connection = new Connection(config);
    return new Promise(resolve => {
        connection.on('connect', error => {
            resolve(connection)
        })
        connection.on('debug', function (err) {
            console.log('debug:', err);
        });
    })
}

async function execQuery(query, connection) {
    return new Promise(resolve => {
        const res = [];
        const request = new Request(query, (err) => {
            if (err) {
                throw err
            }
        });

        request.on('row', columns => {
            const row = {};
            columns.forEach(column => {
                row[column.metadata.colName] = column.value;
            });
            res.push(row)
        });
        request.on('requestCompleted', () => {
            resolve(res)
        });
        connection.execSql(request);
    })
}
