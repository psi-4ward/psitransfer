import { Selector } from 'testcafe';
import { clearDownloadedFile, compareFiles, sharedData, waitForFileDownload } from './helper';

const pwdField = Selector('.well input[type=password]');
const fileToDownload = 'psitransfer.gif';

fixture('PsiTransfer Download')

test.before(async t => {
  clearDownloadedFile(fileToDownload)
})
('Download', async t => {
  // Open download page
  await t.navigateTo(sharedData.shareLink);

  // Expect a password field
  await t
    .expect(pwdField.exists).ok();

  // Enter the passowrd
  await t
    .typeText(pwdField, 'bacon')
    .click(Selector('button.decrypt'))
    .expect(pwdField.exists).notOk()
    .wait(5000)

  // Check file list
  await t
    .expect(Selector('table.files tr').count).eql(2);

  // Download file and compare the contents
  // TODO: find out how to use it with browserstack
  // await t.click(Selector('table.files tr').withText(fileToDownload));
  // await waitForFileDownload(fileToDownload);
  // await t.expect(await compareFiles('docs/' + fileToDownload, fileToDownload)).ok();

});
