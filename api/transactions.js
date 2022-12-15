let app = require("express")();
let server = require("http").Server(app);
let bodyParser = require("body-parser");
//const Realm = require("realm");
let Datastore = require("nedb");
let Inventory = require("./inventory");
let Swal = require('sweetalert2');
const BSON = require('bson');
var Readable = require('stream').Readable;
let moment = require('moment');

// const Realm = require("realm")
// //onst InventorySchema = require("./datastore/Inventory")

// const realmApp = new Realm.App({ id: "fahud-pos-0-lippj" });
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const TransactSchema = {

  name: 'Transaction',

  properties: {
    _partitionKey: 'string?',
  receiptNumber: 'string',
  order: 'string',
  ref_number: 'string',
  customer: 'string',
  status: 'string',
  subtotal: 'double',
  tax: 'double',
  order_type: 'int',
  items: 'string',
  date: 'date',
  payment_type: 'string',
  payment_info: 'string',
  total: 'double',
  paid: 'double',
  change: 'double',
  _id: 'objectId',
  till: 'string',
  mac: 'string',
  user: 'string',
  user_id: 'string',
  flag:'string',
  saved:'string'
},
primaryKey: '_id'
}

const cartSchema = {
  name: 'Cart',
  embedded: 'true',
  properties: {
    id: 'string',
    itemId: 'string',
    category: 'string',
    discount: 'double',
    itemName: 'string',
    barcode: 'string',
    price: 'double',
    quantity: 'int'
  },
  primaryKey: 'id'
}

app.use(bodyParser.json());

module.exports = app;
 
let transactionsDB = new Datastore({
  filename: process.env.APPDATA+"/POS/server/databases/transactions.db",
  autoload: true
});


transactionsDB.ensureIndex({ fieldName: '_id', unique: true });

app.get("/", function(req, res) {
  res.send("Transactions API");
});

 
app.get("/all", function(req, res) {
//   transactionsDB.update( {
// }, {
//   $set: {
//     user_id:1,
//     user:1
  
//   }
// },{},
// );

  transactionsDB.find({flag: 'Connected'}, function(err, docs) {
    res.send(docs);
    console.log('trans '+JSON.stringify(docs))
  });
});

app.get( "/deleteTransactions", function ( req, res ) {
  transactionsDB.remove( { },{ multi: true }, function ( err, numRemoved ) {
      if ( err ) res.status( 500 ).send( err );
      else res.sendStatus( 200 );
  } );
} );


 
app.get("/on-hold", function(req, res) {
  transactionsDB.find(
    { $and: [{ ref_number: {$ne: ""}}, { status: 0  }]},    
    function(err, docs) {
      if (docs) res.send(docs);
    }
  );
});



app.get("/customer-orders", function(req, res) {
  transactionsDB.find(
    { $and: [{ customer: {$ne: "0"} }, { status: 0}, { ref_number: ""}]},
    function(err, docs) {
      if (docs) res.send(docs);
    }
  );
});



app.get("/by-date", function(req, res) {

  let startDate = moment(req.query.start).toDate()
 // new Date(req.query.start);
  let endDate = moment(req.query.end).toDate()
  //new Date(req.query.end);
  
 // console.log('this is start'+startDate.toISOString()+'this is end'+endDate.toISOString())

  if(req.query.user == 0 && req.query.till == 0) {
      transactionsDB.find(
        { $and: [{ date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() }}, { status: parseInt(req.query.status) }] },
        function(err, docs) {
          console.log('we start here')
      docs.forEach((transaction,index) => {
      
          console.log('tras date'+transaction.date)
          console.log('query start date'+startDate.toJSON())
        
          });
          console.log('query end date date'+endDate.toJSON())
          if (docs) res.send(docs);
        }
        
      );
  }


  if(req.query.user != 0 && req.query.till == 0) {
    transactionsDB.find(
      { $and: [{ date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() }}, { status: parseInt(req.query.status) }, { user_id: parseInt(req.query.user) }] },
      function(err, docs) {
        if (docs) res.send(docs);
      }
    );
  }

  if(req.query.user == 0 && req.query.till != 0) {
    transactionsDB.find(
      { $and: [{ date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() }}, { status: parseInt(req.query.status) }, { till: parseInt(req.query.till) }] },
      function(err, docs) {
        if (docs) res.send(docs);
      }
    );
  }

  if(req.query.user != 0 && req.query.till != 0) {
    transactionsDB.find(
      { $and: [{ date: { $gte: startDate.toJSON(), $lte: endDate.toJSON() }}, { status: parseInt(req.query.status) }, { till: parseInt(req.query.till) }, { user_id: parseInt(req.query.user) }] },
      function(err, docs) {
        if (docs) res.send(docs);
      }
    );
  }

});

app.post("/deleteTransactions", function(req, res){
  transactionsDB.remove({}, {},function(err){
    if(err) res.status(500).send(err);
    else{
      res.sendStatus(200);
    }
  }); 
});



app.post("/new", function(req, res) {
  let newTransaction = req.body;
 console.log('New transaction received'+ newTransaction._id)
 console.log('The new transaction received is'+ JSON.stringify(newTransaction))
  transactionsDB.insert(newTransaction, function(err, transaction) {    
    if (err) res.status(500).send(err);
    else {
     res.sendStatus(200);

     if(newTransaction.paid >= newTransaction.total){
        Inventory.decrementInventory(newTransaction.items);
        
     }
     
    }
  });
});

app.post("/save", function(req, res) {
  let transaction = req.body;
    transactionsDB.update( {
        _id: transaction.oderId
    }, {
      $set: {
        saved:transaction.saved
      }
    },{},
  );
  res.send( transaction.orderId );
});


app.put("/new", function(req, res) {
  let oderId = req.body._id;
  let recalledTransaction = req.body
  console.log('transaction received'+req.body._id)
  console.log('this is the transaction received'+JSON.stringify(req.body))

  transactionsDB.update( {_id: parseInt(req.body._id)}, recalledTransaction, function (
      err,
      transacation
      
  ) {
      if ( err ) {
        console.log('transacation edit failed '+err)
        res.status( 500 ).send( err );
      }
      else {
        console.log('transaction edit success')
        res.sendStatus( 200 );
      }
  } );

  transactionsDB.find({ _id: oderId }, function(err, doc) {
    if (doc){
      console.log('this is the newly saved transaction '+doc[0]);
      
    } 
    if(err){
      console.log(err)
    }
  });
});


app.post( "/delete", function ( req, res ) {
 let transaction = req.body;
  transactionsDB.remove( {
      _id: transaction.orderId
  }, function ( err, numRemoved ) {
      if ( err ) res.status( 500 ).send( err );
      else res.sendStatus( 200 );
  } );
} );



app.get("/:transactionId", function(req, res) {
  transactionsDB.find({ _id: req.params.transactionId }, function(err, doc) {
    if (doc) res.send(doc[0]);
  });
});
