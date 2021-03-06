opera.isReady(function() {
    var tests = {}; // Asynchronous tests

    tests["block"] = async_test("Blocking by resource type: object (embed).");
    block.add("*fail.swf*", {resources: types("object")});

    opera.extension.onmessage = function(evt) {
    	opera.postError(JSON.stringify(evt.data));

    	if (evt.data.type === "contentblocked") {
    		tests["block"].step(function(){
    			assert_equals(evt.data.url, "http://t/resources/objects/fail.swf", "The correct URL should be blocked.");
    			assert_equals(evt.data.tagName.toUpperCase(), "EMBED", "The correct element should be blocked.");
    		});
    	} else if (evt.data.type === "contentunblocked") {
    		tests["block"].step(function(){
    			assert_unreached("Unexpected message recieved: " + JSON.stringify(evt.data))
    		});
    	} else {
    		return // Ignore contentallowed events
    	}
    	tests["block"].done();
    }

    var data = "<!DOCTYPE html><embed src='http://t/resources/objects/fail.swf'>";

    createTab({url: getProxyURL(encodeURIComponent(window.btoa(data)))});

    /*
    "other":*            urlfilter.RESOURCE_OTHER,             //
    "script":            urlfilter.RESOURCE_SCRIPT,            // scripts/external.js
    "image":             urlfilter.RESOURCE_IMAGE,             // images/pass.png | images/fail.png (.gif)
    "stylesheet":        urlfilter.RESOURCE_STYLESHEET,        // pass.css | fail.css
    "object":            urlfilter.RESOURCE_OBJECT,            // objects/pass2.swf | fail.swf
    "subdocument":       urlfilter.RESOURCE_SUBDOCUMENT,       // pass.html | fail.html
    "document":*         urlfilter.RESOURCE_DOCUMENT,          // pass.html | fail.html
    "refresh":           urlfilter.RESOURCE_REFRESH,           // (use data URL)
    "xmlhttprequest":    urlfilter.RESOURCE_XMLHTTPREQUEST,    // pass.html | fail.html
    "objectsubrequest":* urlfilter.RESOURCE_OBJECT_SUBREQUEST, // 
    "media":             urlfilter.RESOURCE_MEDIA,             // /core/standards/web-apps/media/non-automated/visual/pass.ogg | fail.ogg
    "font":*             urlfilter.RESOURCE_FONT               // fonts/AHEM____.TTF
    */                                                           
});
