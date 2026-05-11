const express = require('express');
const _ = require('lodash');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const Constants = require('../../common/constants');
const auth = require('../../middlewares/auth');
const saleService = require('../../services/saleService');
const branchesService = require('../../services/branchesService');
const userService = require('../../services/userService');
const {Worker} = require("worker_threads");
const ExcelJS = require("exceljs");
const provinceService = require("../../services/provinceService");
const districtService = require("../../services/districtService");
router.get('/list', auth.authenticateToken, getSaleList);
router.get('/check-sell', auth.authenticateToken, checkRangePriceSell);

async function getSaleList(req, res) {
    try {
        const response = await saleService.getSaleList();
        if (!response) {
            return RestAPI.notFound(res, 'Create branch failed');
        }
        RestAPI.success(res, response);
    } catch (error) {
        return RestAPI.serverError(res, 'Internal server error', error);
    }
}

async function checkRangePriceSell(req, res) {
    const {role, id} = req.auth;
    const {sell_price} = req.query;

    try {
        if (role === 'sale') {
            const response = await saleService.checkRangePriceSell(sell_price, id);
            if (!response) {
                return RestAPI.notFound(res, 'Create branch failed');
            }
            return RestAPI.success(res, response);
        }
        return RestAPI.success(res, 'ok');
    } catch (error) {
        return RestAPI.serverError(res, 'Internal server error', error);
    }
}

const generateDataSale = async (req, res) => {
    const {query} = req;
    try {
        const {province} = query;
        const workbook = new ExcelJS.Workbook();
        const wb = await workbook.xlsx.readFile('public/template/Template_User.xlsx').catch(err => {
            console.log(err);
        });

        const branchesResult = await branchesService.getBranchesList({
            limit: 100
        });
        const roleResult = await userService.getRole();
        const {data: listProvince} = await provinceService.getList({
            limit: 100,
            keyword: province,
        });
        const {data: listDistrict} = await districtService.getList({
            limit: 2000,
            province_city_id: _.first(listProvince).id,
        });

        const worksheet = wb.getWorksheet('Sheet1');
        let queryDB = ``;
        worksheet.eachRow(function (row, rowNumber) {
            if (rowNumber === 1) {
                return;
            }
            const [dataEmpty, dataName, dataEmail, dataPhone, dataRole, dataBranch, dataProvince, dataDistricts, dataPriceSellFrom, dataPriceSellTo, dataPriceRentFrom, dataPriceRentTo] = row.values;
            console.log(dataEmail);
            const branchDetail = _.find(branchesResult.branches_list, {title: dataBranch});
            let roleData = _.find(roleResult, {role: `${_.lowerCase(dataRole)}`});
            // let listOfDistricts = _.split(_.trim(dataDistricts), ',');
            if (!_.isUndefined(branchDetail)) {
                queryDB += `WITH ins${rowNumber} AS (
                            insert
                            into users (full_name, username, password, status, raw_phone_number)
                            VALUES ('${dataName}', '${dataEmail}', '9145df64c38e9fe27b19a8fc1ce1b2359768d46bfd347f56d14762bd8642797b', 1,
                                '${dataPhone}') returning id)
                                    , sale${rowNumber} AS (
                            insert
                            into sales (user_id, status, sell_price_from, sell_price_to, rent_price_from, rent_price_to,
                                        type)
                            values ((select ins${rowNumber}.id from ins${rowNumber}), 1, ${dataPriceSellFrom}, ${dataPriceSellTo}, ${dataPriceRentFrom}, ${dataPriceRentTo}, 1)
                                returning id, user_id)
                                    , saleBranch${rowNumber} AS (
                            INSERT
                            INTO sale_branch (sale_id, branch_id)
                            values ((select sale${rowNumber}.id from sale${rowNumber}), '${branchDetail.id}'))
                                    , saleRole${rowNumber} AS (
                            insert
                            into users_roles (user_id, role_id)
                            values ((select sale${rowNumber}.user_id from sale${rowNumber}), '${roleData.id}'))
                `;
                // if (!_.isEmpty(listOfDistricts)) {
                    let querySaleDistrict = `
                    insert
                    into sale_district(sale_id, districts_id)
                    values`;
                //     listOfDistricts.forEach((districtValue, index) => {
                //         let districtDetail = _.find(listDistrict, {title: `Quận ${districtValue}`});
                //         if (_.isUndefined(districtDetail)) {
                //             districtDetail = _.find(listDistrict, {title: `Huyện ${districtValue}`});
                //         }
                //         if (!_.isUndefined(districtDetail)) {
                //             if (index == 0) {
                //                 querySaleDistrict += ` ((select sale${rowNumber}.id from sale${rowNumber}), ${districtDetail.id})`
                //             } else {
                //                 querySaleDistrict += `, ((select sale${rowNumber}.id from sale${rowNumber}), ${districtDetail.id})`
                //             }
                //
                //         }
                //     })

                listDistrict.forEach((districtDetail, index) => {
                    if (!_.isUndefined(districtDetail)) {
                        if (index == 0) {
                            querySaleDistrict += ` ((select sale${rowNumber}.id from sale${rowNumber}), ${districtDetail.id})`
                        } else {
                            querySaleDistrict += `, ((select sale${rowNumber}.id from sale${rowNumber}), ${districtDetail.id})`
                        }

                    }
                })

                queryDB += `${querySaleDistrict};`;

                // }
            }
        })
        res.render('streets', {
            data: queryDB,
        });
    } catch (error) {
        return RestAPI.serverError(res, 'Internal server error', error);
    }
};

router.get('/generate-sale', generateDataSale);
module.exports = router;
