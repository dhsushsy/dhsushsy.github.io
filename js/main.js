/* globals */

const salt = 'snHHdjsdawj^%££&*(mNddwww><sj22&&66%%£MMNNs**&)(^^bdssnsnns'
var pubnub = null;
var keys = [];
var channel = null;
var _uuid = null;  
var repeat_rate = 10000;
var max_age = 60; //delete messages older than max_age seconds

/*
 * Must match between admin and page
 */

function gen_keys(str)
{
    keys = [];
    for(var i=0;i<3;i++) {
        var hash = sjcl.hash.sha256.hash(str+salt);
        str = sjcl.codec.hex.fromBits(hash);
        keys.push(str);
    }
}


/*
 * @channel: Channel name
 * @key: auth key
 * @success: callback according to whehter login suceeds
 *
 */

function init_messaging(success)
{
    if(_uuid==null) _uuid = PubNub.generateUUID(); //global
  
    //Create the pubnub object
    //Note that pubnub is global
    
    pubnub = new PubNub({
        publishKey: 'pub-c-b028f0d2-c487-4077-873d-205c1daf2962',
        subscribeKey: 'sub-c-07c3771c-2d90-11e7-9488-0619f8945a4f',
        authKey: keys[2],
        cipherKey: keys[1], //key+salt,
        ssl: true,
        uuid: _uuid
    });

    //Send a test message to see if authentication successful

    pubnub.publish(
    {
        message: { 
            message: "login"
        },
        channel: channel,
        sendByPost: true, // true to send via post
        storeInHistory: false, //override default storage options
    }, 
    function (status, response) {
        if (status.error) {
            success(false); 
        } else {
            success(true);
        }
    });
    
   
    //Recieve message via pubnub network
    
    pubnub.addListener({
      message: function(obj) {

            //Get and decrypt contents of messages
            var json = obj.message;
            if(json.message=='login') return;
            var json_obj = JSON.parse(json);
            var text = null;
            text = sjcl.decrypt(keys[0],json);

            //Create the new message div
            const msg = $('div.msg-empty').clone();
            msg.find('div.msg-text').text(text);
            msg.removeClass('msg-empty');
            if(_uuid==json_obj['uuid']) msg.addClass('msg-self');
            else msg.addClass('msg-other');
            msg.data('timestamp',obj.timetoken); 

            //Add to the DOM
            $('div.msg-list').append(msg);

            //Set times, check which messages should be deleted etc
            update_times();
            $("html, body").animate({ scrollTop: $(document).height()-$(window).height() });

      }});

    pubnub.subscribe({channels:[channel]});

}


/*
 * send a cal
 */

function send_call()
{
    temp = new PubNub({
        publishKey: 'pub-c-b028f0d2-c487-4077-873d-205c1daf2962',
        subscribeKey: 'sub-c-07c3771c-2d90-11e7-9488-0619f8945a4f',
        ssl: true,
        uuid: _uuid
    });
    temp.publish(
    {
        message: { 
            text: 'call'
        },
        channel: 'status',
        sendByPost: false, // true to send via post
        storeInHistory: false, //override default storage options
    }, 
    function (status, response) {
        if (status.error) {
            //console.log('error publishing message '+status);
        } else {
            //console.log("message Published timetoken", response.timetoken);
        }
    }
    );
}

/* send message via pubnub network */

function send_msg(text)
{
    if(text.trim()=='call') {
        send_call();
    }

    json = sjcl.encrypt(keys[0],text); //returns json
    obj = JSON.parse(json);
    obj['uuid'] = _uuid;
    json = JSON.stringify(obj);
    pubnub.publish({channel : channel,storeInHistory: false,sendByPost: true, message : json,x : (json='')});
    $('textarea#comment').val('');
    $('textarea#comment').focus();
}



/* 
 * Set / check time of messages, delete old messages 
 *
 */

function update_times()
{
    //First get time according to pubnub
    pubnub.time(function(status, response) 
    {
        if (status.error) {
            //handle
        } else {
            $('.msg').each(function() {
                if(!$(this).hasClass('msg-empty')) {

                    //Write the age
                    var age = (response.timetoken - $(this).data('timestamp')) / (10000000);
                    age = Math.max(1,age); //in seconds
                    $(this).find('div.msg-info').text(age.toFixed(0)+' seconds ago'); 
                    //Delete old messages
                    if(age>max_age) $(this).remove();  
                }
            });
        }
    })      
}

/* Set up repeat time functions etc */

function repeat()
{
    if(pubnub != null) {
        update_times();    

    }
    setTimeout(repeat,repeat_rate);
    
}

$(document).ready(function() {
    
    $('textarea#comment').val('');
    $('div.chat').hide(); 
    $('label.login-error').hide(); 
    $('#inputPassword').focus();

    
    $('button.login-btn').click(function() {
        var user = 'chat';
        var pass = $.trim($('#inputPassword').val());
        $('#inputUser').val('');
        $('#inputPassword').val('');

        channel = user; //global
        gen_keys(pass); //populate the global keys array

        init_messaging(function(success) {
            console.log('login: '+success);
            if(success) {
                $('div.login').hide();
                $('div.chat').show();
                $('textarea#comment').focus();
                setTimeout(repeat,repeat_rate);

            }
            else {
                $('label.login-error').show(); 

            }
        });
    });

    $('textarea#comment').keydown(function(e) {
        if ((e.keyCode || e.charCode) === 13) {
            var text = $('textarea#comment').val();
            send_msg(text); 
        }
    });
    
    $('textarea#comment').keyup(function(e) {
        if ((e.keyCode || e.charCode) === 13) {
            $('textarea#comment').val('');
        }
    });

    $('button.chat-btn').click(function() 
    {
        var text = $('textarea#comment').val();
        send_msg(text);
    });
    
    $('button.logout-btn').click(function() 
    {
        $('textarea#comment').val();
        pubnub = null;
        key = null;
        channel = null;
        _uuid = null;  
        $('div.login').show();
        $('div.chat').hide();
        $('label.login-error').hide(); 
        location.reload(); 
    });

});
