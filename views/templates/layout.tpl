<?php
use oat\tao\helpers\Template;
use oat\tao\helpers\Layout;
use oat\tao\helpers\UserPilotTemplateHelper;
use oat\tao\model\session\Dto\UserPilotDto;
use oat\tao\model\theme\Theme;

$releaseMsgData = Layout::getReleaseMsgData();

// yellow bar if
// never removed by user
// and version considered unstable resp. sandbox
$hasVersionWarning = empty($_COOKIE['versionWarning'])
    && !!$releaseMsgData['msg']
    && ($releaseMsgData['is-unstable']
    || $releaseMsgData['is-sandbox']);
?>
<!doctype html>
<html class="no-js<?php if (!$hasVersionWarning): ?> no-version-warning<?php endif;?>" lang="<?= tao_helpers_I18n::getLangCode() ?>">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="google" content="notranslate" />

    <?= Layout::renderThemeTemplate(Theme::CONTEXT_BACKOFFICE, 'head') ?>

    <title><?= Layout::getTitle() ?></title>

    <?= tao_helpers_Scriptloader::render() ?>

    <?= Layout::getAmdLoader(Template::js('loader/tao.min.js', 'tao'), 'controller/backoffice') ?>
    <link rel="stylesheet" href="<?= Layout::getThemeStylesheet(Theme::CONTEXT_BACKOFFICE) ?>" />
</head>

<body class="
    <?= Layout::isSolarDesignEnabled() ? 'solar-design' : '' ?>
    <?= Layout::isSmallNavi() ? ' small-navi' : '' ?>
    <?= Layout::isQuickWinsDesignEnabled() ? ' qc-wins' : '' ?>
">
<?php Template::inc('blocks/requirement-check.tpl', 'tao'); ?>
<div class="content-wrap">
    <?php Template::inc('blocks/cookies-banner.tpl', 'tao'); ?>
    <?php /* alpha|beta|sandbox message */
    if($hasVersionWarning) {
        Template::inc('blocks/version-warning.tpl', 'tao');
    }?>

    <?php /* <header> + <nav> */
    Template::inc('blocks/header.tpl', 'tao'); ?>

    <div id="feedback-box"></div>

    <?php /* actual content */
    $contentTemplate = Layout::getContentTemplate();
    Template::inc($contentTemplate['path'], $contentTemplate['ext']); ?>
</div>

<?=Layout::renderThemeTemplate(Theme::CONTEXT_BACKOFFICE, 'footer')?>

<div class="loading-bar"></div>
<?php Layout::printAnalyticsCode(); ?>
<?php UserPilotTemplateHelper::userPilotCode(new
UserPilotDto(common_session_SessionManager::getSession())); ?>
</body>
</html>
