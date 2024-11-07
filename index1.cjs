const mongoose = require('mongoose');
const express = require('express');
const app = express();
const { Op } = require('sequelize');
const session = require('express-session');
app.use(express.json())
const con = mongoose.connection;
const fetch = require('node-fetch');
const path = require("path")
const url = 'mongodb://127.0.0.1:27017/nms';
const cors = require('cors');
var bodyParser = require('body-parser');
session.Cookie.secure = true
const cookieParser = require('cookie-parser')
const { check,validationResult } = require('express-validator')
//const { validationResult, matchedData } = require('express-validator')
require('dotenv').config()
mongoose.connect(url, {useNewUrlParser:true, useUnifiedTopology:true})
con.on('open', () => {
    console.log('MongoDB connected...')
})
app.set('view engine', 'ejs')
app.use(cookieParser())
app.use(express.static('public'))
app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: 'MY_SECRET',
    cookie: { secure: false }, 
  }));
  
app.use(express.urlencoded({ extended: true }))
app.use(bodyParser.urlencoded({ extended: true }))
const port = 3000
/*  PASSPORT SETUP  */

const passport = require('passport');
var userProfile;
if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    session.Cookie.secure = true;
}
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, "views"))
app.get('/error', (req, res) => res.send("error logging in"));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});
/*  Google AUTH  */
const {OAuth2Client} = require('google-auth-library'); 
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email']
  },
  function(accessToken, refreshToken, profile, done) {
      userProfile=profile;
      return done(null, userProfile);
  }
));
function isLoggedIn(req, res, next) {
    req.user ? next() : res.sendStatus(401)
}
app.get('/', (req, res)=>{
    res.render('auth')
})

app.get('/add', isLoggedIn, (req, res)=>{
    let title = 'Add Users'
    const userName = req.user.displayName
    const first = req.user.first
    const last = req.user.last
    const password = req.user.password
    const userEmail = req.user.emails[0].value
    res.render('add_users',{title: title, userName: userName, userEmail: userEmail, first: first, last: last, password: password, errors: ''})
})

app.get('/edit/:id', isLoggedIn, (req, res, next)=>{
    let title = 'Edit Users'
    const userName = req.user.displayName
    const userEmail = req.user.emails[0].value
    Post.findOneAndUpdate({_id: req.params.id}, req.body, {new:true}, (err, docs) => {
        if(err) {
            console.log(err)
            next(err)
         } else
            res.render('edit_users',{Post: docs, title: title, userName: userName, userEmail: userEmail})
    })
})

app.post('/edit/:id', isLoggedIn, async (req, res, next)=>{
    Post.findByIdAndUpdate({_id: req.params.id}, req.body, (err, docs) => {
        if(err) {
            console.log(err)
            next(err)
         } else {
            console.log('Updated Successfully !!')
            res.redirect('/list')
         }
    })
})

app.get('/delete/:id', isLoggedIn, async (req, res, next)=>{
    Post.findByIdAndDelete({_id: req.params.id}, (err, docs) => {
        if(err) {
            console.log(err)
            next(err)
         } else {
            console.log('Deleted Successfully !!')
            res.redirect('/list')
         }
    })
})

app.post('/submit', [
    check('first').trim().notEmpty().withMessage('First Name required')
    .matches(/^[a-zA-Z ]*$/).withMessage('Only Characters with white space are allowed'),
    check('last').notEmpty().withMessage('Last Name required')
    .matches(/^[a-zA-Z ]*$/).withMessage('Only Characters with white space are allowed'),
    check('password').trim().notEmpty().withMessage('Password required')
    .isLength({ min: 5 }).withMessage('password must be minimum 5 length')
    .matches(/(?=.*?[A-Z])/).withMessage('At least one Uppercase')
    .matches(/(?=.*?[a-z])/).withMessage('At least one Lowercase')
    .matches(/(?=.*?[0-9])/).withMessage('At least one Number')
    .matches(/(?=.*?[#?!@$%^&*-])/).withMessage('At least one special character')
    .not().matches(/^$|\s+/).withMessage('White space not allowed'),
], isLoggedIn, (req, res) => {
    let title = 'Add Users'
    const userName = req.user.displayName
    const userEmail = req.user.emails[0].value
    const errors= validationResult(req)
    const { first, last, password } = req.body
    const frmData = new Post({
        /*gender: req.body.gender,
        title: req.body.title,*/
        first,
        last,
        /*number: req.body.number,
        name: req.body.name,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        postcode: req.body.postcode,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        offset: req.body.offset,
        description: req.body.description,
        uuid: req.body.uuid,
        username: req.body.username,*/
        password,
        /*salt: req.body.salt,
        md5: req.body.md5,
        sha1: req.body.sha1,
        sha256: req.body.sha256,
        date: req.body.date,
        age: req.body.age,
        rdate: req.body.rdate,
        rage: req.body.rage,
        iname: req.body.iname,
        value: req.body.value,
        large: req.body.large,
        medium: req.body.medium,
        thumbnail: req.body.thumbnail,
        nat: req.body.nationality,*/
    })
    if(!errors.isEmpty()){  
        res.render('add_users', {title: title, userName: userName, userEmail: userEmail, first: first, last: last, password: password, errors: errors.mapped()})
        //return res.status(422).json({ errors: errors.mapped() })
    } else {
        frmData.save()
        .then(doc => {
            console.log('Data saved !')
            console.log(frmData)
            res.redirect('/list')
        })
        .catch(err => {
            console.log(err)
            res.status(500).send('Error saving data !')
        })
    }
    
})

app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) {
            // Handle any logout errors here.
            console.error(err);
            // You can choose to render an error page or redirect to a specific route.
            res.redirect('/error');
        } else {
            // If the logout was successful, redirect the user to the home page or another location.
            res.redirect('/');
        }
    })
})

app.get('/list', isLoggedIn, async (req,res) => {
    try {

        var userData = await Post.find({});
        //res.status(200).send(userData)
        const userName = req.user.displayName
        const userEmail = req.user.emails[0].value
        let title = 'Profile Page'
        res.render('list',{title: title, userName: userName, userEmail: userEmail, userData: userData})
    } catch (e) {
        console.log(e);
    }
});  

app.post('/list', isLoggedIn, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.body; // Get search query
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        
        const startIndex = (pageNumber - 1) * limitNumber;

        // Search logic
        const products = await Post.find({
            $or: [
                { first: { $regex: search, $options: 'i' } },
                { last: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                // Add other fields you want to search through
            ]
        })
        .limit(limitNumber)
        .skip(startIndex)
        .exec();

        const total = await Post.countDocuments({
            $or: [
                { first: { $regex: search, $options: 'i' } },
                { last: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
            ]
        });

        const response = {
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            products,
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("'/api/sessions'", passport.authenticate('google', { scope: ['profile', 'email'] }));
 
const rst = new mongoose.Schema({
    gender:{
        type: String,
        //required: true,
    },
    title:{
        type:String,
        //required:true,
    },
    first:{
        type: String,
        //required: true,
    },
    last:{
        type: String,
        //required: true,
    },
    number:{
        type: Number,
        //required: true,
    },
    name:{
        type: String,
        //required: true,
    },
    city:{
        type: String,
        //required: true,
    },
    state:{
        type: String,
        //required: true,
    },
    country:{
        type: String,
        //required: true,
    },
    postcode:{
        type: String,
        //required: true,
    },
    latitude:{
        type: String,
        //required: true,
    },
    longitude:{
        type: String,
        //required: true,
    },
    offset:{
        type: String,
        //required: true,
    },
    description:{
        type: String,
        //required: true,
    },
    uuid:{
        type: String,
        //required: true,
    },
    username:{
        type: String,
        //required: true,
    },
    password:{
        type: String,
        //required: true,
    },
    salt:{
        type: String,
        //required: true,
    },
    md5:{
        type: String,
        //required: true,
    },
    sha1:{
        type: String,
        //required: true,
    },
    sha256:{
        type: String,
        //required: true,
    },
    date:{
        type: String,
        //required: true,
    },
    age:{
        type: Number,
        //required: true,
    },
    rdate:{
        type: JSON,
        //required: false,
    },
    rage:{
        type: JSON,
        //required: false,
    },
    iname:{
        type: JSON,
        //required: false,
    },
    value:{
        type: String,
        //required: true,
    },
    large:{
        type: String,
        //required: true,
    },
    medium:{
        type: String,
        //required: true,
    },
    thumbnail:{
        type: String,
        //required: true,
    },
    nat:{
        type: String,
        //required: true,
    },
});
var Post = mongoose.model('Post', rst)
async function records(){
    let m=0, f=0;
    let j = 20;
    while(j>0){
        const api = await fetch('https://randomuser.me/api/')
        const resp = await api.json()
        for(let i=0;i<resp.results.length;i++)
        {
            if(await resp.results[i].gender == 'male')
                m++
            else
                f++   
            console.log(resp.results[i])
            const post = new Post({
                gender:await resp.results[i]['gender'],
                title:await resp.results[i].name['title'],
                first:await resp.results[i].name['first'],
                last:await resp.results[i].name['last'],
                number:await resp.results[i].location.street['number'],
                name:await resp.results[i].location.street['name'],
                city:await resp.results[i].location['city'],
                state:await resp.results[i].location['state'],
                country:await resp.results[i].location['country'],
                postcode:await resp.results[i].location['postcode'],
                latitude:await resp.results[i].location.coordinates['latitude'],
                longitude:await resp.results[i].location.coordinates['longitude'],
                offset:await resp.results[i].location.timezone['offset'],
                description:await resp.results[i].location.timezone['description'],
                uuid:await resp.results[i].login['uuid'],
                username:await resp.results[i].login['username'],
                password:await resp.results[i].login['password'],
                salt:await resp.results[i].login['salt'],
                md5:await resp.results[i].login['md5'],
                sha1:await resp.results[i].login['sha1'],
                sha256:await resp.results[i].login['sha256'],
                date:await resp.results[i].dob['date'],
                age:await resp.results[i].dob['age'],
                rdate:await resp.results[i].registered['date'],
                rage:await resp.results[i].registered['age'],
                iname:await resp.results[i].id['name'],
                value:await resp.results[i].id['value'],
                large:await resp.results[i].picture['large'],
                medium:await resp.results[i].picture['medium'],
                thumbnail:await resp.results[i].picture['thumbnail'],
                nat:await resp.results[i]['nat'],
            })
            await post.save()
        }
        j--;
    }
    console.log(`Total Males: ${m}`)
    console.log(`Total Females: ${f}`)
}
records()
app.get('/api/sessions/oauth/google', 
    passport.authenticate('google', { 
        failureRedirect: '/error',
        successRedirect: '/list'
    })
)
app.listen(port, () => {
    console.log(`Server has started on port ${port} !`)
})