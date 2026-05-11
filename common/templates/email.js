const Constants = require('../../common/constants');
/**
 *
 * @param {Object} data
 * @returns {String}
 */
const createAccountTemplate = (data) => {
    const {full_name, email} = data;
    return `
    Xin chào ${full_name},<br/>
        <br/>
Chào mừng bạn đã đến với hệ thống của Tiến Thành. Để có thể bắt đầu sử dụng hệ thống, bạn có thể đăng nhập với thông tin sau:<br/>
<br/>
${Constants.FO_DOMAIN_URL}/user/login<br/>
Id: ${email}<br/>
Password: ${Constants.DEFAULT_PASSWORD_RAW}<br/>
<br/>
Đề nghị bạn nên đổi mật khẩu sau lần đăng nhập đầu tiên.<br/>
<br/>
Trân trọng,<br/>
Tiến Thành system.`
}
const createExportTemplate = (data) => {
    const {full_name, link} = data;
    return `<div>Xin chào ${full_name}, </br>
               <p>Hiện tại Yêu cầu Export Bất động sản của bạn đã được hệ thống xử lý thành công, vui lòng vào <a href="${link}">đây</a></p></br>
            <p>Trân trọng,</p> </br>
            <p>Tiến Thành system.</p> </br>
            </div>
`
}
const createImportTemplateSuccess = (data) => {
    const {full_name, link} = data;
    return `<div>Xin chào ${full_name}, </br>
               <p>Hiện tại Yêu cầu Import Bất động sản của bạn đã được hệ thống xử lý thành công, vui lòng vào <a href="${link}">đây</a></p></br>
            Trân trọng,</br>
            Tiến Thành system.</br>
            </div>
`
}
const createImportTemplateFail = (data) => {
    const {full_name, link} = data;
    return `<div>Xin chào ${full_name}, </br>
               <p>Hiện tại yêu cầu Import Bất động sản của bạn chưa hợp lệ hoặc xử lý không thành công, vui lòng vào <a href="${link}">đây</a></p></br>
            <p>Trân trọng,</p></br>
            <p>Tiến Thành system.</p></br>
            </div>
`
}
module.exports = {
    createAccountTemplate,
    createExportTemplate,
    createImportTemplateSuccess,
    createImportTemplateFail
};