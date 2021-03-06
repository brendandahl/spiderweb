/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

var MockFilePicker = SpecialPowers.MockFilePicker;
MockFilePicker.init(window);

// Trigger a save of a link in public mode, then trigger an identical save
// in private mode and ensure that the second request is differentiated from
// the first by checking that cookies set by the first response are not sent
// during the second request.
function triggerSave(aWindow, aCallback) {
  info("started triggerSave");
  var fileName;
  let testBrowser = aWindow.gBrowser.selectedBrowser;
  // This page sets a cookie if and only if a cookie does not exist yet
  let testURI = "http://mochi.test:8888/browser/browser/base/content/test/general/bug792517-2.html";
  testBrowser.loadURI(testURI);
  testBrowser.addEventListener("pageshow", function pageShown(event) {
    info("got pageshow with " + event.target.location);
    if (event.target.location != testURI) {
      info("try again!");
      testBrowser.loadURI(testURI);
      return;
    }
    info("found our page!");
    testBrowser.removeEventListener("pageshow", pageShown, false);

    waitForFocus(function () {
      info("register to handle popupshown");
      aWindow.document.addEventListener("popupshown", contextMenuOpened, false);

      var link = testBrowser.contentDocument.getElementById("fff");
      info("link: " + link);
      EventUtils.synthesizeMouseAtCenter(link,
                                         { type: "contextmenu", button: 2 },
                                         testBrowser.contentWindow);
      info("right clicked!");
    }, testBrowser);
  }, false);

  function contextMenuOpened(event) {
    info("contextMenuOpened");
    aWindow.document.removeEventListener("popupshown", contextMenuOpened);

    // Create the folder the link will be saved into.
    var destDir = createTemporarySaveDirectory();
    var destFile = destDir.clone();

    MockFilePicker.displayDirectory = destDir;
    MockFilePicker.showCallback = function(fp) {
      info("showCallback");
      fileName = fp.defaultString;
      info("fileName: " + fileName);
      destFile.append (fileName);
      MockFilePicker.returnFiles = [destFile];
      MockFilePicker.filterIndex = 1; // kSaveAsType_URL
      info("done showCallback");
    };

    mockTransferCallback = function(downloadSuccess) {
      info("mockTransferCallback");
      onTransferComplete(aWindow, downloadSuccess, destDir);
      destDir.remove(true);
      ok(!destDir.exists(), "Destination dir should be removed");
      ok(!destFile.exists(), "Destination file should be removed");
      mockTransferCallback = null;
      info("done mockTransferCallback");
    }

    // Select "Save Link As" option from context menu
    var saveLinkCommand = aWindow.document.getElementById("context-savelink");
    info("saveLinkCommand: " + saveLinkCommand);
    saveLinkCommand.doCommand();

    event.target.hidePopup();
    info("popup hidden");
  }

  function onTransferComplete(aWindow, downloadSuccess, destDir) {
    ok(downloadSuccess, "Link should have been downloaded successfully");
    aWindow.close();

    executeSoon(() => aCallback());
  }
}

function test() {
  info("Start the test");
  waitForExplicitFinish();

  var gNumSet = 0;
  function testOnWindow(options, callback) {
    info("testOnWindow(" + options + ")");
    var win = OpenBrowserWindow(options);
    info("got " + win);
    whenDelayedStartupFinished(win, () => callback(win));
  }

  function whenDelayedStartupFinished(aWindow, aCallback) {
    info("whenDelayedStartupFinished");
    Services.obs.addObserver(function observer(aSubject, aTopic) {
      info("whenDelayedStartupFinished, got topic: " + aTopic + ", got subject: " + aSubject + ", waiting for " + aWindow);
      if (aWindow == aSubject) {
        Services.obs.removeObserver(observer, aTopic);
        executeSoon(aCallback);
        info("whenDelayedStartupFinished found our window");
      }
    }, "browser-delayed-startup-finished", false);
  }

  mockTransferRegisterer.register();

  registerCleanupFunction(function () {
    info("Running the cleanup code");
    mockTransferRegisterer.unregister();
    MockFilePicker.cleanup();
    Services.obs.removeObserver(observer, "http-on-modify-request");
    Services.obs.removeObserver(observer, "http-on-examine-response");
    info("Finished running the cleanup code");
  });

  function observer(subject, topic, state) {
    info("observer called with " + topic);
    if (topic == "http-on-modify-request") {
      onModifyRequest(subject);
    } else if (topic == "http-on-examine-response") {
      onExamineResponse(subject);
    }
  }

  function onExamineResponse(subject) {
    let channel = subject.QueryInterface(Ci.nsIHttpChannel);
    info("onExamineResponse with " + channel.URI.spec);
    if (channel.URI.spec != "http://mochi.test:8888/browser/browser/base/content/test/general/bug792517.sjs") {
      info("returning");
      return;
    }
    try {
      let cookies = channel.getResponseHeader("set-cookie");
      // From browser/base/content/test/general/bug792715.sjs, we receive a Set-Cookie
      // header with foopy=1 when there are no cookies for that domain.
      is(cookies, "foopy=1", "Cookie should be foopy=1");
      gNumSet += 1;
      info("gNumSet = " + gNumSet);
    } catch (ex) {
      if (ex.result == Cr.NS_ERROR_NOT_AVAILABLE) {
        info("onExamineResponse caught NOTAVAIL" + ex);
      } else {
        info("ionExamineResponse caught " + ex);
      }
    }
  }

  function onModifyRequest(subject) {
    let channel = subject.QueryInterface(Ci.nsIHttpChannel);
    info("onModifyRequest with " + channel.URI.spec);
    if (channel.URI.spec != "http://mochi.test:8888/browser/browser/base/content/test/general/bug792517.sjs") {
      return;
    }
    try {
      let cookies = channel.getRequestHeader("cookie");
      info("cookies: " + cookies);
      // From browser/base/content/test/general/bug792715.sjs, we should never send a
      // cookie because we are making only 2 requests: one in public mode, and
      // one in private mode.
      throw "We should never send a cookie in this test";
    } catch (ex) {
      if (ex.result == Cr.NS_ERROR_NOT_AVAILABLE) {
        info("onModifyRequest caught NOTAVAIL" + ex);
      } else {
        info("ionModifyRequest caught " + ex);
      }
    }
  }

  Services.obs.addObserver(observer, "http-on-modify-request", false);
  Services.obs.addObserver(observer, "http-on-examine-response", false);

  testOnWindow(undefined, function(win) {
    // The first save from a regular window sets a cookie.
    triggerSave(win, function() {
      is(gNumSet, 1, "1 cookie should be set");

      // The second save from a private window also sets a cookie.
      testOnWindow({private: true}, function(win) {
        triggerSave(win, function() {
          is(gNumSet, 2, "2 cookies should be set");
          finish();
        });
      });
    });
  });
}

Cc["@mozilla.org/moz/jssubscript-loader;1"]
  .getService(Ci.mozIJSSubScriptLoader)
  .loadSubScript("chrome://mochitests/content/browser/toolkit/content/tests/browser/common/mockTransfer.js",
                 this);

function createTemporarySaveDirectory() {
  var saveDir = Cc["@mozilla.org/file/directory_service;1"]
                  .getService(Ci.nsIProperties)
                  .get("TmpD", Ci.nsIFile);
  saveDir.append("testsavedir");
  if (!saveDir.exists()) {
    info("create testsavedir!");
    saveDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
  }
  info("return from createTempSaveDir: " + saveDir.path);
  return saveDir;
}
