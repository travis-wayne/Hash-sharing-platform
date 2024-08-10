// using express JS
var express = require("express");
var app = express();

// express formidable is used to parse the form data values
var formidable = require("express-formidable");
app.use(formidable());

// use mongo DB as database
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;

// the unique ID for each mongo DB document
var ObjectId = mongodb.ObjectId;

// receiving http requests
var httpObj = require("http");
var http = httpObj.createServer(app);

// to encrypt/decrypt passwords
var bcrypt = require("bcrypt");

// to store files
var fileSystem = require("fs");

// to start the session
var session = require("express-session");
app.use(session({
    secret: 'secret key',
    resave: false,
    saveUninitialized: false
}));

// define the publically accessible folders
app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/img", express.static(__dirname + "/public/img"));
app.use("/public/font-awesome-4.7.0", express.static(__dirname + "/public/font-awesome-4.7.0"));
app.use("/public/fonts", express.static(__dirname + "/public/fonts"));

// using EJS as templating engine
app.set("view engine", "ejs");

// main URL of website
var mainURL = "http://localhost:3000";

// global database object
var database = null;

// app middleware to attach main URL and user object with each request
app.use(function (request, result, next) {
    request.mainURL = mainURL;
    request.isLogin = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    // continue the request
    next();
});

var formidable = require("express-formidable");
app.use(formidable());
var bcrypt = require("bcrypt");
var nodemailer = require("nodemailer");
var nodemailerFrom = "dhanshree.shinde23@vit.edu";
var nodemailerObject = {
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: "dhanshree.shinde23@vit.edu",
        pass: "hjkjbmzkx7678"
    }
};

// recursive function to get the file from uploaded
function recursiveGetFile(files, _id) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        // return if file type is not folder and ID is found
        if (file.type != "folder") {
            if (file._id == _id) {
                return file;
            }
        }

        // if it is a folder and have files, then do the recursion
        if (file.type == "folder" && file.files.length > 0) {
            singleFile = recursiveGetFile(file.files, _id);
            // return the file if found in sub-folders
            if (singleFile != null) {
                return singleFile;
            }
        }
    }
}

// function to add new uploaded object and return the updated array
function getUpdatedArray(arr, _id, uploadedObj) {
    for (var a = 0; a < arr.length; a++) {
        // push in files array if type is folder and ID is found
        if (arr[a].type == "folder") {
            if (arr[a]._id == _id) {
                arr[a].files.push(uploadedObj);
                arr[a]._id = ObjectId(arr[a]._id);
            }

            // if it has files, then do the recursion
            if (arr[a].files.length > 0) {
                arr[a]._id = ObjectId(arr[a]._id);
                getUpdatedArray(arr[a].files, _id, uploadedObj);
            }
        }
    }

    return arr;
}

// recursive function to remove the file and return the updated array
function removeFileReturnUpdated(arr, _id) {
    for (var a = 0; a < arr.length; a++) {
        if (arr[a].type != "folder" && arr[a]._id == _id) {
            // remove the file from uploads folder
            try {
                fileSystem.unlinkSync(arr[a].filePath);
            } catch (exp) {
                // 
            }
            // remove the file from array
            arr.splice(a, 1);
            break;
        }

        // do the recursion if it has sub-folders
        if (arr[a].type == "folder" && arr[a].files.length > 0) {
            arr[a]._id = ObjectId(arr[a]._id);
            removeFileReturnUpdated(arr[a].files, _id);
        }
    }

    return arr;
}

// recursive function to search uploaded files
function recursiveSearch(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        if (file.type == "folder") {
            // search folder case-insensitive
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearch(file.files, query);
                if (singleFile != null) {
                    // need parent folder in case of files
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}

// recursive function to search shared files
function recursiveSearchShared(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        var file = (typeof files[a].file === "undefined") ? files[a] : files[a].file;

        if (file.type == "folder") {
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearchShared(file.files, query);
                if (singleFile != null) {
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}

// start the http server
http.listen(3000, function () {
    console.log("Server started at " + mainURL);

    // connect with mongo DB server
    mongoClient.connect("mongodb+srv://joshuaxp9:abdulwaheed@cluster0.eca86dt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
        useUnifiedTopology: true
    }, function (error, client) {

        // connect database (it will automatically create the database if not exists)
        database = client.db("file_transfer");
        console.log("Database connected.");



        // search files or folders
        app.get("/Search", async function (request, result) {
            const search = request.query.search;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });
                var fileUploaded = await recursiveSearch(user.uploaded, search);
                var fileShared = await recursiveSearchShared(user.sharedWithMe, search);

                // check if file is uploaded or shared with user
                if (fileUploaded == null && fileShared == null) {
                    request.status = "error";
                    request.message = "File/folder '" + search + "' is neither uploaded nor shared with you.";

                    result.render("Search", {
                        "request": request
                    });
                    return false;
                }

                var file = (fileUploaded == null) ? fileShared : fileUploaded;
                file.isShared = (fileUploaded == null);
                result.render("Search", {
                    "request": request,
                    "file": file
                });

                return false;
            }

            result.redirect("/Login");
        });


        // get all files shared with logged-in user
        app.get("/SharedWithMe/:_id?", async function (request, result) {
            result.render("SharedWithMe", {
                "request": request
            });
        });

        app.post("/DeleteLink", async function (request, result) {

            const _id = request.fields._id;

            if (request.session.user) {
                var link = await database.collection("public_links").findOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                if (link == null) {
                    request.session.status = "error";
                    request.session.message = "Link does not exists.";

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                    return false;
                }

                await database.collection("public_links").deleteOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                request.session.status = "success";
                request.session.message = "Link has been deleted.";

                const backURL = request.header("Referer") || "/";
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });

        app.get("/MySharedLinks", async function (request, result) {
            if (request.session.user) {
                var links = await database.collection("public_links").find({
                    "uploadedBy._id": ObjectId(request.session.user._id)
                }).toArray();

                result.render("MySharedLinks", {
                    "request": request,
                    "links": links
                });
                return false;
            }

            result.redirect("/Login");
        });

        app.get("/SharedViaLink/:hash", async function (request, result) {
            const hash = request.params.hash;

            var link = await database.collection("public_links").findOne({
                "hash": hash
            });

            if (link == null) {
                request.session.status = "error";
                request.session.message = "Link expired.";

                result.render("SharedViaLink", {
                    "request": request
                });
                return false;
            }

            result.render("SharedViaLink", {
                "request": request,
                "link": link
            });
        });

        app.post("/ShareViaLink", async function (request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });
                var file = await recursiveGetFile(user.uploaded, _id);

                if (file == null) {
                    request.session.status = "error";
                    request.session.message = "File does not exists";

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                    return false;
                }

                bcrypt.hash(file.name, 10, async function (error, hash) {
                    if (error) {
                        console.error("Hashing error:", error);
                        return;
                    }
                    hash = hash.substring(10, 20);
                    const link = mainURL + "/SharedViaLink/" + hash;

                    const now = new Date();

                    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    function getOrdinalSuffix(day) {
                        if (day >= 11 && day <= 13) return 'th';
                        switch (day % 10) {
                            case 1: return 'st';
                            case 2: return 'nd';
                            case 3: return 'rd';
                            default: return 'th';
                        }
                    }

                    const dateTimeString = `${now.getDate()}${getOrdinalSuffix(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

                    await database.collection("public_links").insertOne({
                        "hash": hash,
                        "file": file,
                        "uploadedBy": {
                            "_id": user._id,
                            "name": user.name,
                            "email": user.email
                        },
                        "createdAt": now.getTime()
                    });

                    request.session.status = "success";
                    request.session.message = `Share link: ${link} \nCreated On ${dateTimeString}`;

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                });

                return false;
            }

            result.redirect("/Login");
        });

        // delete uploaded file
        app.post("/DeleteFile", async function (request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var updatedArray = await removeFileReturnUpdated(user.uploaded, _id);
                for (var a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                }

                await database.collection("users").updateOne({
                    "_id": ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });

                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });

        // download file
        app.post("/DownloadFile", async function (request, result) {
            const _id = request.fields._id;

            var link = await database.collection("public_links").findOne({
                "file._id": ObjectId(_id)
            });

            if (link != null) {
                fileSystem.readFile(link.file.filePath, function (error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": link.file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": link.file.name
                    });
                });
                return false;
            }

            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var fileUploaded = await recursiveGetFile(user.uploaded, _id);

                if (fileUploaded == null) {
                    result.json({
                        "status": "error",
                        "message": "File is neither uploaded nor shared with you."
                    });
                    return false;
                }

                var file = fileUploaded;

                fileSystem.readFile(file.filePath, function (error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": file.name
                    });
                });
                return false;
            }

            result.json({
                "status": "error",
                "message": "Please login to perform this action."
            });
            return false;
        });

        // view all files uploaded by logged-in user
        app.get("/MyUploads", async function (request, result) {
            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var uploaded = user.uploaded;

                result.render("MyUploads", {
                    "request": request,
                    "uploaded": uploaded
                });
                return false;
            }

            result.redirect("/Login");
        });

        // upload new file
        app.post("/UploadFile", async function (request, result) {
            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                if (request.files.file.size > 0) {

                    const _id = request.fields._id;

                    var uploadedObj = {
                        "_id": ObjectId(),
                        "size": request.files.file.size, // in bytes
                        "name": request.files.file.name,
                        "type": request.files.file.type,
                        "filePath": "",
                        "createdAt": new Date().getTime()
                    };

                    var filePath = "public/uploads/" + user.email + "/" + new Date().getTime() + "-" + request.files.file.name;
                    uploadedObj.filePath = filePath;

                    if (!fileSystem.existsSync("public/uploads/" + user.email)) {
                        fileSystem.mkdirSync("public/uploads/" + user.email);
                    }

                    // Read the file
                    fileSystem.readFile(request.files.file.path, function (err, data) {
                        if (err) throw err;
                        console.log('File read!');

                        // Write the file
                        fileSystem.writeFile(filePath, data, async function (err) {
                            if (err) throw err;
                            console.log('File written!');

                            await database.collection("users").updateOne({
                                "_id": ObjectId(request.session.user._id)
                            }, {
                                $push: {
                                    "uploaded": uploadedObj
                                }
                            });

                            request.session.status = "success";
                            request.session.message = "File uploaded successfully !!!.";

                            result.redirect("/MyUploads/" + _id);
                        });

                        // Delete the file
                        fileSystem.unlink(request.files.file.path, function (err) {
                            if (err) throw err;
                            console.log('File deleted!');
                        });
                    });

                } else {
                    request.status = "error";
                    request.message = "Please select valid image.";

                    result.render("MyUploads", {
                        "request": request
                    });
                }

                return false;
            }

            result.redirect("/Login");
        });

        // logout the user
        app.get("/Logout", function (request, result) {
            request.session.destroy();
            result.redirect("/");
        });

        // show page to login
        app.get("/Login", function (request, result) {
            result.render("Login", {
                "request": request
            });
        });

        // authenticate the user
        app.post("/Login", async function (request, result) {
            var email = request.fields.email;
            var password = request.fields.password;

            var user = await database.collection("users").findOne({
                "email": email
            });

            if (user == null) {
                request.status = "error";
                request.message = "Email does not exist.";
                result.render("Login", {
                    "request": request
                });

                return false;
            }

            bcrypt.compare(password, user.password, function (error, isVerify) {
                if (isVerify) {
                    if (user.isVerified) {
                        request.session.user = user;
                        result.redirect("/");

                        return false;
                    }

                    request.status = "error";
                    request.message = "Kindly verify your email.";
                    result.render("Login", {
                        "request": request
                    });
                    return false;

                }

                request.status = "error";
                request.message = "Password is not correct.";
                result.render("Login", {
                    "request": request
                });
            });
        });

        // register the user
        app.post("/Register", async function (request, result) {

            var name = request.fields.name;
            var email = request.fields.email;
            var password = request.fields.password;
            var reset_token = "";
            var isVerified = false;
            var verification_token = new Date().getTime();

            var user = await database.collection("users").findOne({
                "email": email
            });
            console.log("Sending mail");

            if (user == null) {
                bcrypt.hash(password, 10, async function (error, hash) {
                    await database.collection("users").insertOne({
                        "name": name,
                        "email": email,
                        "password": hash,
                        "reset_token": reset_token,
                        "uploaded": [],
                        "sharedWithMe": [],
                        "isVerified": isVerified,
                        "verification_token": verification_token
                    }, async function (error, data) {

                        var transporter = nodemailer.createTransport(
                            nodemailerObject);

                        var text = "Please verify your account by clicking the following link:" + mainURL + "/verifyEmail/" + email + "/" + verification_token;
                        var html = "Please verify your account by click the following link: <br><br> <a href='" + mainURL + "/verifyEmail/" + email + "/" + verification_token + "'>Confirm Email</a> <br><br> Thank you.";
                        await transporter.sendMail({
                            from: nodemailerFrom,
                            to: email,
                            subject: "Email Verification",
                            text: text,
                            html: html
                        }, function (error, info) {
                            if (error) {
                                console.error(error);
                            } else {
                                console.log("Email sent:" + info.response);
                            }

                            request.status = "success";
                            request.message = "Signed up successfully. An email has been sent to verify your account. Once verified, you will be able to login and start using file transfer.";

                            result.render("Register", {
                                "request": request
                            });

                        });
                    });
                });
            } else {
                request.status = "error";
                request.message = "Email already exist.";

                result.render("Register", {
                    "request": request
                });
            }
        });
        app.get("/verifyEmail/:email/:verification_token", async function (request, result) {
            var email = request.params.email;
            var verification_token = request.params.verification_token;
            var user = await database.collection("users").findOne({
                $and: [{
                    "email": email,
                }, {
                    "verification_token": parseInt(verification_token)
                }]
            });
            console.log(user);
            if (user == null) {
                request.status = "erroг";
                request.message = "Email does not exists. Or verification link is expired.";
                result.render("Login", {
                    "request": request
                });
            } else {
                await database.collection("users").findOneAndUpdate({
                    $and: [{
                        "email": email,
                    }, {
                        "verification_token": parseInt(verification_token)
                    }]
                }, {
                    $set: {
                        "verification_token": "",
                        "isVerified": true
                    }
                });
                request.status = "success";
                request.message = "Account has been verified. Please try login.";
                result.render("Login", {
                    "reuest": request
                });
            }
        });

        app.get("/ForgotPassword", function (request, result) {
            result.render("ForgotPassword", {
                "request": request
            });
        });

        app.post("/SendRecoveryLink", async function (request, result) {
            var email = request.fields.email;
            var user = await database.collection("users").findOne({
                "email": email
            });
            if (user == null) {
                request.status = "error";
                request.message = "Email does not exists.";
                result.render("ForgotPassword", {
                    "request": request
                });
                return false;
            }
            var reset_token = new Date().getTime();
            await database.collection("users").findOneAndUpdate({
                "email": email
            }, {
                $set: {
                    "reset_token": reset_token
                }
            });
            var transporter = nodemailer.createTransport(nodemailerObject);
            var text = "Please click the following link to reset your password:" + mainURL + "/ResetPassword/" + email + "/" + reset_token;
            var html = "Please click the following link to reset your password: <br><br> <a href='" + mainURL + "/ ResetPassword/" + email + "/" + reset_token + "'>Reset Password</a> <br><br> Thank you.";

            transporter.sendMail({
                from: nodemailerFrom,
                to: email,
                subject: "Reset Password",
                text: text,
                html: html
            }, function (error, info) {
                if (error) {
                    console.error(error);
                } else {
                    console.log("Email sent: " + info.response);
                }
                request.status = "success";
                request.message = "Email has been sent with the link to recover the password.";
                result.render("ForgotPassword", {
                    "request": request
                });
            });
        });

        app.get("/ResetPassword/:email/:reset_token", async function (request, result) {
            var email = request.params.email;
            var reset_token = request.params.reset_token;
            var user = await database.collection("users").findOne({
                $and: [{
                    "email": email
                }, {
                    "reset_token": parseInt(reset_token)
                }]
            });
            if (user == null) {
                request.status = "error";
                request.message = "Link is expired.";
                result.render("Error", {
                    "request": request
                });
                return false;
            }
            result.render("ResetPassword", {
                "request": request,
                "email": email,
                "reset_token": reset_token
            });
        });
        app.post("/ResetPassword", async function (request, result) {
            var email = request.fields.email;
            var reset_token = request.fields.reset_token;
            var new_password = request.fields.new_password;
            var confirm_password = request.fields.confirm_password;
            if (new_password != confirm_password) {
                request.status = "error";
                request.message = "Password does not match.";
                result.render("ResetPassword", {
                    "request": request,
                    "email": email,
                    "reset_token": reset_token
                });
                return false;
            }
            var user = await database.collection("users").findOne({
                $and: [{
                    "email": email,
                }, {
                    "reset_token": parseInt(reset_token)
                }]
            });
            if (user == null) {
                request.status = "error";
                request.message = "Email does not exists. Or recovery link is expired.";
                result.render("ResetPassword", {
                    "request": request,
                    "email": email,
                    "reset_token": reset_token
                });
                return false;
            }
            bcrypt.hash(new_password, 10, async function (error, hash) {
                await database.collection("users").findOneAndUpdate({
                    $and: [{
                        "email": email,
                    }, {
                        "reset_token": parseInt(reset_token)
                    }]
                }, {
                    $set: {
                        "reset_token": "",
                        "password": hash
                    }

                });
                request.status = "success";
                request.message = "Password has been changed. Please try login again.";
                result.render("Login", {
                    "request": request
                });
            });
        });



        // show page to do the registration
        app.get("/Register", function (request, result) {
            result.render("Register", {
                "request": request
            });
        });

        // home page
        app.get("/", function (request, result) {
            result.render("index", {
                "request": request
            });
        });
    });
});