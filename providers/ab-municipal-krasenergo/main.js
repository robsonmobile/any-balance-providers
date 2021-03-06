﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
  'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
  Connection: 'keep-alive'
};

function main(){
    var prefs = AnyBalance.getPreferences();
    var baseurl = "http://krsk-sbit.ru/quasar.php";
    var now = new Date();
    var threeMonthsAgo = new Date(now.getFullYear(), now.getMonth()-3, 1);
    AnyBalance.setDefaultCharset('windows-1251');

    // Входим либо по лиц. счету + фамилии, либо по имени + паролю
    if(!(prefs.abonentid && prefs.fam) && !(prefs.login && prefs.password))
        throw new AnyBalance.Error('Необходимо ввести либо номер финансово-лицевого счета и фамилию, либо имя пользователя и пароль.');

    // Передача фактических показаний прибора учета не работает на сайте
    var html = AnyBalance.requestPost(baseurl, {
        abonentid: prefs.login || prefs.abonentid,
        fam: prefs.password  || prefs.fam,
        showpass: 'on',
        main: 'Войти'
    }, addHeaders({Referer: baseurl}));

	if (!html || AnyBalance.getLastStatusCode() > 400) {
		AnyBalance.trace(html);
		throw new AnyBalance.Error('Сайт провайдера временно недоступен! Попробуйте обновить данные позже.');
	}

    //Ссылка на печать квитанции
    if(!/Лицевой cчет N/i.test(html)){
        var error = getParam(html, null, null, [/<strong[^>]+color:\s*red[^>]*>([\s\S]*?)<\/strong>/i, /<div[^>]+class="error"[^>]*>([\s\S]*?)<\/div>/i, /<\/form>(?:\s+|<br[^>]*>)*<b[^>]*>([\s\S]*?)<\/b>/i], replaceTagsAndSpaces);
        if(error)
            throw new AnyBalance.Error(error, null, /некорректные данные/i.test(html));
        AnyBalance.trace(html);
        throw new AnyBalance.Error('Не удалось войти в личный кабинет. Сайт изменен?');
    }

    var result = {success: true}, tr;

    getParam(html, result, 'fio', /Абонент:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
    getParam(html, result, 'licschet', /Лицевой cчет N:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
    getParam(html, result, 'balance', /((?:Переплата|Задолженность):[\s\S]*?<td[^>]*>[\s\S]*?)<\/td>/i, [/:[\s\S]*?<\/th>/i, '', /Задолженность/ig, '-', replaceTagsAndSpaces], parseBalance);
	
	if(AnyBalance.isAvailable('lastpaydate', 'lastpaysum')){
		html = AnyBalance.requestGet(baseurl + '?action=payment_history', g_headers);
        tr = getParam(html, null, null, /<table[^>]+quasar_table[^>]*>(?:[\s\S](?!<\/table>))*?(<tr[^>]*>(?:[\s\S](?!<\/tr>|<\/table>))*?[\s\S]<\/tr>)\s*<\/table>/i);
        if(tr){
            getParam(tr, result, 'lastpaydate', /(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDate);
            getParam(tr, result, 'lastpaysum', /(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        }
    }

    if(AnyBalance.isAvailable('lastbilldate', 'indication','cons_ind','cost_ind','cons_com','cost_com','cons_tot','cost_tot')){
		html = AnyBalance.requestGet(baseurl + '?action=invoice_history', g_headers);
        tr = getParam(html, null, null, /<table[^>]+quasar_table[^>]*>(?:[\s\S](?!<\/table>))*?(<tr[^>]*>(?:[\s\S](?!<\/tr>|<\/table>))*?[\s\S]<\/tr>)\s*<\/table>/i);
        if(tr){
            getParam(tr, result, 'lastbilldate', /(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDate);
            getParam(tr, result, 'indication', /(?:[\s\S]*?<td[^>]*>){3}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
            getParam(tr, result, 'cons_ind', /(?:[\s\S]*?<td[^>]*>){4}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
            getParam(tr, result, 'cost_ind', /(?:[\s\S]*?<td[^>]*>){5}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
            getParam(tr, result, 'cons_com', /(?:[\s\S]*?<td[^>]*>){6}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
            getParam(tr, result, 'cost_com', /(?:[\s\S]*?<td[^>]*>){7}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
            getParam(tr, result, 'cons_tot', /(?:[\s\S]*?<td[^>]*>){8}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
            getParam(tr, result, 'cost_tot', /(?:[\s\S]*?<td[^>]*>){9}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        }
    }

    AnyBalance.setResult(result);
}