import { ClientFunction, Selector } from 'testcafe';
import { sharedData } from './helper';

const uploadUrl = process.env.TEST_URL || 'http://localhost:3000/';
const fileInputField = Selector('#fileInput');
const passwordField = Selector('#password');
const retentionField = Selector('#retention');
const uploadBtn = Selector('#uploadBtn');

fixture`PsiTransfer Upload`
  .page`${uploadUrl}`;

test('Upload', async t => {
  // Set Password
  await t
    .typeText(passwordField, 'bacon')
    .expect(passwordField.value).eql('bacon');

  // Set retention
  await t
    .click(retentionField)
    .click(retentionField.find('option[value="3600"]'))
    .expect(retentionField.value).eql("3600");

  // Add files
  const fileInputFiles = ClientFunction(() => {
    const res = [];
    const files = fileInputField().files;
    for (let i=0; i<files.length; i++) {
      res.push(files[i].name);
    }
    return res;
  }, { dependencies: { fileInputField } });
  await t
    .setFilesToUpload(fileInputField, [
      '../../LICENSE',
      '../../Dockerfile',
      '../../docs/psitransfer.gif',
    ])
    .expect(Selector('.upload-files table tr').count).eql(3)
    .expect(fileInputFiles()).contains('LICENSE')
    .expect(fileInputFiles()).contains('psitransfer.gif');

  // Remove file
  await t
    .click(Selector('.upload-files table td.btns a').nth(1))
    .expect(Selector('.upload-files table tr').count).eql(2);

  // Enter comments
  const commentField1 = Selector('.upload-files input[type=text]').nth(0);
  const commentField2 = Selector('.upload-files input[type=text]').nth(1);
  await t
    .typeText(commentField1, 'some comment')
    .typeText(commentField2, 'other comment')
    .expect(commentField1.value).eql('some comment')
    .expect(commentField2.value).eql('other comment')

  // run upload
  await t
    .click(uploadBtn)
    .expect(Selector('.well .text-success').innerText).contains('Upload completed')

  const shareLink = await Selector('.share-link a').innerText;
  await t
    .expect(shareLink).contains(uploadUrl)
    .expect(shareLink).match(/[a-z0-9]{12}$/);

  sharedData.shareLink = shareLink;
});
