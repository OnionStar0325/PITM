<?php

namespace Kanboard\Plugin\PITM\Controller;

use Kanboard\Controller\BaseController;

class PasteController extends BaseController
{
    public function upload()
    {
        $values = $this->request->getJson();
        if (empty($values['data']) || strpos($values['data'], ',') === false) {
            $this->response->status(400);
            return;
        }

        $base64Image = explode(',', $values['data'])[1];

        if (isset($values['wiki_id']) && intval($values['wiki_id']) > 0)
        {
            $wikiId = intval($values['wiki_id']);
            $ImageId = null;

            try {
                if ($this->container->offsetExists('wikiFileModel')) {
                    $ImageId = $this->wikiFileModel->uploadScreenshot($wikiId, $base64Image);
                } elseif (class_exists('\Kanboard\Plugin\Wiki\Model\WikiFileModel')) {
                    $wikiFileModel = new \Kanboard\Plugin\Wiki\Model\WikiFileModel($this->container);
                    $ImageId = $wikiFileModel->uploadScreenshot($wikiId, $base64Image);
                }

                if ($ImageId)
                {
                    $this->response->html('<img src="?controller=WikiFileViewController&amp;action=image&amp;plugin=wiki&amp;file_id=' . $ImageId . '" class="enlargable">');
                }
            } catch (\Exception $e) {
                $this->logger->error('PITM uploadScreenshot error: ' . $e->getMessage());
                $this->response->html('> ⚠️ **[Error]** ' . $e->getMessage());
            }
        }
        elseif (isset($values['task_id']) && intval($values['task_id']) > 0)
        {
            $taskId = intval($values['task_id']);
            
            try {
                $ImageId = $this->taskFileModel->uploadScreenshot($taskId, $base64Image);

                if ($ImageId)
                {
                    $this->response->html('<img src="?controller=FileViewerController&amp;action=image&amp;task_id=' . $taskId . '&amp;file_id=' . $ImageId . '" class="enlargable">');
                }
            } catch (\Exception $e) {
                $this->logger->error('PITM task uploadScreenshot error: ' . $e->getMessage());
                $this->response->html('> ⚠️ **[Error]** ' . $e->getMessage());
            }
        }
        else
        {
            $tempPath = isset($values['path']) ? $values['path'] : '';

            $ImageId = $this->pasteFileModel->storeTempContent($tempPath, $base64Image);

            if ($ImageId)
            {
                $this->response->html('<PITM:' . $ImageId . '>');
            }
        }
    }
}
